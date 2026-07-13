import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, gte, lt, or } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { triggerAppointmentInquiry } from "@/lib/appointment-inquiry";
import { sendNotificationEmail } from "@/lib/notification-email";
import { sendSmtpMail } from "@/lib/smtp-mail";
import { getViewer } from "@/lib/viewer";
import { getAppUrl } from "@/lib/app-url";
import {
  appointmentRequirements,
  appointments,
  appointmentFiles,
  customers,
  notificationPrefs,
  notifications,
  prowlKeys,
  users,
} from "@/db/schema";
import { buildServiceRemoteFilePath, buildServicesDir, isSftpEnabled, withSftp } from "@/lib/sftp";

export const runtime = "nodejs";

type ServiceType = "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";
type RdType = "KTW" | "NKTW" | "RTW" | "NEF" | "ITW" | "S_RTW" | "SONSTIGES";
type QualKind = "QUAL_RD" | "QUAL_AUSB";

function hashPassword(plain: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(plain, salt, 32);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

function generatePassword() {
  return crypto.randomBytes(9).toString("base64url");
}

function safeFileName(name: string) {
  return name.replaceAll(/[^\w.\- ()]/g, "_").slice(0, 160);
}

function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

function formatHoursLabel(startAt: Date, endAt: Date) {
  const mins = minutesBetween(startAt, endAt);
  const hours = mins / 60;
  if (Number.isInteger(hours)) return `${hours}h`;
  const rounded = Math.round(hours * 100) / 100;
  return `${String(rounded).replace(".", ",")}h`;
}

async function sendCustomerMail({ to, username, password }: { to: string; username: string; password: string }) {
  const appUrl = getAppUrl();

  const text = `Hallo!\n\nDein Account wurde angelegt.\n\nLogin: ${appUrl}\nUsername: ${username}\nPasswort: ${password}\n\nHinweis: Bitte Passwort nach dem ersten Login ändern.`;
  const html = buildEmailHtml({
    preheader: "Dein Milodo Account ist bereit.",
    title: "Willkommen bei Milodo",
    intro: "Dein Account wurde angelegt. Nutze die Zugangsdaten unten für den Login.",
    sections: [
      { label: "Login", value: appUrl },
      { label: "Username", value: username },
      { label: "Passwort", value: password },
    ],
    footerNote: "Sicherheitshinweis: Bitte ändere dein Passwort nach dem ersten Login.",
  });

  const result = await sendSmtpMail({
    to,
    subject: "Willkommen bei Milodo – Zugangsdaten",
    text,
    html,
  });
  if (!result.ok) throw new Error(result.error);
}

function buildRequirementsLabel(reqs: Array<{ minCount: number; value: string }>) {
  const clean = reqs
    .map((r) => ({ minCount: Math.max(1, Math.round(Number(r.minCount || 1))), value: String(r.value || "").trim() }))
    .filter((r) => r.value);
  if (!clean.length) return "Angefordertes Personal: —";
  return `Angefordertes Personal: ${clean.map((r) => `mind. ${r.minCount}× ${r.value}`).join(" • ")}`;
}

async function buildServicePdf({
  title,
  serviceType,
  startAt,
  endAt,
  customerName,
  customerContact,
  customerAddress,
  customerMail,
  customerPhone,
  locationName,
  locationAddress,
  notes,
  visitors,
  participants,
  requirements,
  assets,
}: {
  title: string;
  serviceType: ServiceType;
  startAt: Date;
  endAt: Date;
  customerName: string;
  customerContact: string;
  customerAddress: string;
  customerMail: string;
  customerPhone: string;
  locationName: string;
  locationAddress: string;
  notes: string;
  visitors: number | null;
  participants: Array<string>;
  requirements: Array<{ minCount: number; value: string }>;
  assets: Array<{ count: number; item: string }>;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let y = 841.89 - margin;
  const line = (text: string, opts?: { bold?: boolean; size?: number; color?: { r: number; g: number; b: number } }) => {
    const size = opts?.size ?? 11;
    const f = opts?.bold ? fontBold : font;
    const color = opts?.color ?? { r: 0.07, g: 0.09, b: 0.12 };
    page.drawText(text, { x: margin, y, size, font: f, color: rgb(color.r, color.g, color.b) });
    y -= size + 6;
  };

  line(title, { bold: true, size: 16 });
  y -= 4;
  line(
    `${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(startAt)} • ${new Intl.DateTimeFormat("de-DE", {
      timeStyle: "short",
    }).format(startAt)}–${new Intl.DateTimeFormat("de-DE", { timeStyle: "short" }).format(endAt)} (${formatHoursLabel(
      startAt,
      endAt,
    )})`,
    { size: 11, color: { r: 0.35, g: 0.39, b: 0.46 } },
  );
  y -= 10;

  const kv = (k: string, v: string) => {
    page.drawText(k, { x: margin, y, size: 10, font: fontBold, color: rgb(0.35, 0.39, 0.46) });
    page.drawText(v || "—", { x: margin + 140, y, size: 10, font, color: rgb(0.07, 0.09, 0.12) });
    y -= 16;
  };

  kv("Bereich", serviceType === "RD_BOERSE" ? "Rettungsdienst-Börse" : serviceType === "SANITATSDIENST" ? "Sanitätsdienst" : "Erste Hilfe");
  kv("Kunde", customerName);
  kv("Ansprechpartner", customerContact);
  kv("Adresse", customerAddress);
  kv("E-Mail", customerMail);
  kv("Telefon", customerPhone);
  kv("Einsatzort", locationName);
  kv("Einsatzort Adresse", locationAddress);
  if (typeof visitors === "number") kv("Geschätzte Besucher", String(visitors));

  if (requirements.length) {
    y -= 8;
    line("Personal", { bold: true, size: 12 });
    for (const r of requirements) {
      line(`mind. ${r.minCount}× ${r.value}`, { size: 10 });
    }
  }

  if (assets.length) {
    y -= 8;
    line("Material / Fahrzeuge", { bold: true, size: 12 });
    for (const a of assets) {
      line(`${a.count}× ${a.item}`, { size: 10 });
    }
  }

  if (notes.trim()) {
    y -= 8;
    line("Bemerkung", { bold: true, size: 12 });
    line(notes.trim(), { size: 10 });
  }

  if (serviceType === "ERSTE_HILFE") {
    y -= 10;
    line("Teilnehmer", { bold: true, size: 12 });
    const tableX = margin;
    const colNameW = 360;
    const colSigW = 140;
    const rowH = 20;

    page.drawRectangle({ x: tableX, y: y - 16, width: colNameW + colSigW, height: 16, color: rgb(0.95, 0.96, 0.98) });
    page.drawText("Name", { x: tableX + 8, y: y - 12, size: 10, font: fontBold, color: rgb(0.35, 0.39, 0.46) });
    page.drawText("Unterschrift", { x: tableX + colNameW + 8, y: y - 12, size: 10, font: fontBold, color: rgb(0.35, 0.39, 0.46) });
    y -= 16;

    const rows = participants.length ? participants : [];
    const count = Math.max(rows.length, 1);
    for (let i = 0; i < count; i++) {
      const name = rows[i] ?? "";
      page.drawRectangle({ x: tableX, y: y - rowH, width: colNameW + colSigW, height: rowH, borderColor: rgb(0.86, 0.88, 0.92), borderWidth: 1 });
      page.drawLine({ start: { x: tableX + colNameW, y: y }, end: { x: tableX + colNameW, y: y - rowH }, thickness: 1, color: rgb(0.86, 0.88, 0.92) });
      if (name) page.drawText(name, { x: tableX + 8, y: y - 14, size: 10, font, color: rgb(0.07, 0.09, 0.12) });
      y -= rowH;
    }
  }

  return Buffer.from(await doc.save());
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  const isAdmin = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const isCustomer = viewer.role === "KUNDE";
  if (!isAdmin && !isCustomer) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    serviceType: ServiceType;
    startAt: string;
    endAt: string;
    eventName?: string;
    rdType?: RdType | null;
    acuteInquiryEnabled?: boolean;
    customer: {
      id?: number | null;
      name: string;
      contactName?: string;
      street?: string;
      houseNumber?: string;
      plz?: string;
      city?: string;
      email?: string;
      phone?: string;
      createAccount?: boolean;
    };
    location: { name: string; street?: string; houseNumber?: string; plz?: string; city?: string };
    requirements: Array<{ kind: QualKind; value: string; minCount: number }>;
    assets: Array<{ item: string; count: number }>;
    visitors?: number | null;
    participants?: Array<string>;
    notes?: string;
  };

  // customer accounts can only request appointments for their own customer + main area
  let customerAccountRow: typeof customers.$inferSelect | null = null;
  if (isCustomer) {
    customerAccountRow =
      (await db.query.customers.findFirst({ where: (t, { eq }) => eq(t.accountUserId, viewer.id) })) ?? null;
    if (!customerAccountRow) return NextResponse.json({ ok: false, error: "no_customer_account" }, { status: 403 });
  }

  const serviceType = (isCustomer ? customerAccountRow!.mainBereich : body.serviceType) as ServiceType;
  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
    return NextResponse.json({ ok: false, error: "invalid_time" }, { status: 400 });
  }

  const customerName = String(isCustomer ? customerAccountRow!.name : body.customer?.name ?? "").trim();
  if (!customerName) return NextResponse.json({ ok: false, error: "missing_customer" }, { status: 400 });

  const locationName = String(body.location?.name ?? "").trim();
  if (!locationName) return NextResponse.json({ ok: false, error: "missing_location" }, { status: 400 });

  // customer: select or create (admin only)
  let customerId = Number(isCustomer ? customerAccountRow!.id : body.customer?.id ?? NaN);
  if (!isCustomer && !Number.isFinite(customerId)) {
    const existing = await db.query.customers.findFirst({ where: (t, { eq }) => eq(t.name, customerName) });
    if (existing) {
      customerId = existing.id;
      await db
        .update(customers)
        .set({
          contactName: String(body.customer.contactName ?? "").trim(),
          street: String(body.customer.street ?? "").trim(),
          houseNumber: String(body.customer.houseNumber ?? "").trim(),
          plz: String(body.customer.plz ?? "").trim(),
          city: String(body.customer.city ?? "").trim(),
          email: String(body.customer.email ?? "").trim(),
          phone: String(body.customer.phone ?? "").trim(),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));
    } else {
      const inserted = await db
        .insert(customers)
        .values({
          name: customerName,
          contactName: String(body.customer.contactName ?? "").trim(),
          street: String(body.customer.street ?? "").trim(),
          houseNumber: String(body.customer.houseNumber ?? "").trim(),
          plz: String(body.customer.plz ?? "").trim(),
          city: String(body.customer.city ?? "").trim(),
          email: String(body.customer.email ?? "").trim(),
          phone: String(body.customer.phone ?? "").trim(),
        })
        .returning({ id: customers.id });
      customerId = inserted.at(0)?.id ?? NaN;
    }
  }

  if (!Number.isFinite(customerId)) return NextResponse.json({ ok: false, error: "customer_failed" }, { status: 500 });

  const customerRow = await db.query.customers.findFirst({ where: (t, { eq }) => eq(t.id, customerId) });
  if (!customerRow) return NextResponse.json({ ok: false, error: "customer_failed" }, { status: 500 });

  // optional customer account (admin only)
  if (isAdmin && body.customer.createAccount) {
    const mail = String(body.customer.email ?? customerRow.email ?? "").trim();
    if (!mail) return NextResponse.json({ ok: false, error: "missing_customer_email" }, { status: 400 });

    const existingUser = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, mail) });
    if (!existingUser) {
      const plain = generatePassword();
      const passwordHash = hashPassword(plain);
      const username = mail;

      const inserted = await db
        .insert(users)
        .values({ username, email: mail, role: "KUNDE", passwordHash })
        .returning({ id: users.id });
      const userId = inserted.at(0)?.id ?? null;
      if (userId) {
        await db.update(customers).set({ accountUserId: userId, updatedAt: new Date() }).where(eq(customers.id, customerId));
      }
      try {
        await sendCustomerMail({ to: mail, username, password: plain });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "mail_failed";
        return NextResponse.json({ ok: false, error: "mail_failed", message: msg }, { status: 400 });
      }
    }
  }

  // title generation
  const year = startAt.getFullYear();
  let title = "";
  let dienstart: RdType | null = null;
  let eventName = "";

  if (serviceType === "RD_BOERSE") {
    dienstart = (body.rdType ?? null) as RdType | null;
    title = `${formatHoursLabel(startAt, endAt)} - ${dienstart ?? "RD"} - ${customerRow.name}`;
  } else if (serviceType === "SANITATSDIENST") {
    eventName = String(body.eventName ?? "").trim();
    if (!eventName) return NextResponse.json({ ok: false, error: "missing_event_name" }, { status: 400 });
    title = eventName;
  } else {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    const rows = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.bereich, "ERSTE_HILFE"), gte(appointments.startAt, from), lt(appointments.startAt, to)));
    const seq = rows.length + 1;
    title = `Erste Hilfe Kurs - ${String(seq).padStart(3, "0")}/${String(year).slice(-2)}`;
  }

  const customerAddress = [customerRow.street, customerRow.houseNumber].filter(Boolean).join(" ").trim();
  const customerCity = [customerRow.plz, customerRow.city].filter(Boolean).join(" ").trim();
  const customerAddrFull = [customerAddress, customerCity].filter(Boolean).join(", ");
  const locationStreet = String(body.location.street ?? "").trim();
  const locationHouse = String(body.location.houseNumber ?? "").trim();
  const locationPlz = String(body.location.plz ?? "").trim();
  const locationCity = String(body.location.city ?? "").trim();
  const locationAddr = [locationStreet, locationHouse].filter(Boolean).join(" ").trim();
  const locationCityLine = [locationPlz, locationCity].filter(Boolean).join(" ").trim();
  const locationAddrFull = [locationAddr, locationCityLine].filter(Boolean).join(", ");

  const einsatzort = [locationName, locationAddrFull].filter(Boolean).join(" • ");

  const details = {
    serviceType,
    rdType: dienstart,
    acuteInquiryEnabled: Boolean(body.acuteInquiryEnabled),
    customer: {
      name: customerRow.name,
      contactName: customerRow.contactName,
      street: customerRow.street,
      houseNumber: customerRow.houseNumber,
      plz: customerRow.plz,
      city: customerRow.city,
      email: customerRow.email,
      phone: customerRow.phone,
      accountUserId: customerRow.accountUserId,
    },
    location: { name: locationName, street: locationStreet, houseNumber: locationHouse, plz: locationPlz, city: locationCity },
    visitors: body.visitors ?? null,
    participants: Array.isArray(body.participants) ? body.participants : [],
    assets: Array.isArray(body.assets) ? body.assets : [],
  };

  const inserted = await db
    .insert(appointments)
    .values({
      startAt,
      endAt,
      title,
      einsatzort,
      customerId,
      bereich: serviceType,
      dienstart: serviceType === "RD_BOERSE" ? dienstart : null,
      eventName,
      notes: String(body.notes ?? "").trim(),
      detailsJson: JSON.stringify(details),
      approved: isAdmin,
      approvedAt: isAdmin ? new Date() : null,
    })
    .returning({ id: appointments.id });

  const appointmentId = inserted.at(0)?.id ?? null;
  if (!appointmentId) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });

  // requirements
  const reqs = Array.isArray(body.requirements) ? body.requirements : [];
  for (const r of reqs) {
    const kind = r.kind === "QUAL_RD" ? "QUAL_RD" : "QUAL_AUSB";
    const value = String(r.value ?? "").trim();
    const minCount = Math.max(1, Math.round(Number(r.minCount ?? 1)));
    if (!value) continue;
    await db
      .insert(appointmentRequirements)
      .values({ appointmentId, kind, value, minCount })
      .onConflictDoNothing();
  }

  // inquiry / requests
  if (isAdmin) {
    try {
      const within7Days = startAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
      const requestKind: "URGENT_REQUESTS" | "REQUESTS_GENERAL" =
        within7Days && body.acuteInquiryEnabled ? "URGENT_REQUESTS" : "REQUESTS_GENERAL";

      const reqLabel = buildRequirementsLabel(
        reqs
          .map((r) => ({
            minCount: Math.max(1, Math.round(Number(r.minCount ?? 1))),
            value: String(r.value ?? "").trim(),
          }))
          .filter((r) => r.value),
      );

      await db.insert(notifications).values({
        scope: "ALL",
        kind: requestKind,
        title: requestKind === "URGENT_REQUESTS" ? "AKUTE ABFRAGE" : "Dienstabfrage",
        body: `${title}\n${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(startAt)}\n${reqLabel}`,
        href: `/appointments/${appointmentId}`,
      });

      await triggerAppointmentInquiry(appointmentId, requestKind).catch(() => null);
    } catch {
      // ignore inquiry errors for now
    }
  } else {
    // customer request: confirmation for customer + info for admin/verwaltung
    try {
      await db.insert(notifications).values({
        scope: "USER",
        userId: viewer.id,
        kind: "SYSTEM",
        title: "Dienst angefordert",
        body: `${title}\n${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(startAt)}`,
        href: `/appointments/${appointmentId}`,
      });

      await db.insert(notifications).values({
        scope: "ALL",
        kind: "SYSTEM",
        title: "Neue Kundenanforderung",
        body: `${customerRow.name}\n${title}\n${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(startAt)}`,
        href: `/appointments/${appointmentId}`,
      });
    } catch {
      // ignore
    }

    const when = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(startAt);
    const url = `${getAppUrl()}/appointments/${appointmentId}`;

    // customer confirmation mail (always, if SMTP enabled)
    const customerTo = String(viewer.email || customerRow.email || "").trim();
    if (customerTo) {
      void sendNotificationEmail({
        to: customerTo,
        subject: "[Milodo] Dienst angefordert",
        preheader: `${title} • ${when}`,
        title: "Dienst angefordert",
        intro: "Wir haben deine Anforderung erhalten. Nach Freigabe wird die Abfrage gestartet.",
        sections: [
          { label: "Dienst", value: title },
          { label: "Zeit", value: when },
          { label: "Einsatzort", value: einsatzort },
        ],
        button: { label: "Zum Dienst", url },
      }).catch(() => null);
    }

    // admin/verwaltung info (email + prowl; kein telegram)
    try {
      const adminRows = await db
        .select({ email: users.email })
        .from(notificationPrefs)
        .innerJoin(users, eq(notificationPrefs.userId, users.id))
        .where(
          and(
            eq(notificationPrefs.key, "CUSTOMER_REQUEST"),
            eq(notificationPrefs.emailEnabled, true),
            or(eq(users.role, "ADMIN"), eq(users.role, "VERWALTUNG")),
          ),
        );

      const adminEmails = Array.from(new Set(adminRows.map((r) => String(r.email || "").trim()).filter(Boolean)));
      await Promise.all(
        adminEmails.map((to) =>
          sendNotificationEmail({
            to,
            subject: "[Milodo] Neue Kundenanforderung",
            preheader: `${customerRow.name} • ${when}`,
            title: "Neue Kundenanforderung",
            intro: "Ein Kunde hat einen Dienst angefordert.",
            sections: [
              { label: "Kunde", value: customerRow.name },
              { label: "Dienst", value: title },
              { label: "Zeit", value: when },
              { label: "Einsatzort", value: einsatzort },
            ],
            button: { label: "Zum Dienst", url },
          }).catch(() => null),
        ),
      );

      const prowlRows = await db
        .select({ apiKey: prowlKeys.apiKey })
        .from(prowlKeys)
        .innerJoin(notificationPrefs, eq(notificationPrefs.userId, prowlKeys.userId))
        .innerJoin(users, eq(users.id, prowlKeys.userId))
        .where(
          and(
            eq(prowlKeys.enabled, true),
            eq(notificationPrefs.key, "CUSTOMER_REQUEST"),
            eq(notificationPrefs.emailEnabled, true),
            or(eq(users.role, "ADMIN"), eq(users.role, "VERWALTUNG")),
          ),
        )
        .limit(25);

      await Promise.all(
        prowlRows.map(async (k) => {
          const key = String(k.apiKey || "").trim();
          if (!key) return;
          await fetch("https://api.prowlapp.com/publicapi/add", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              apikey: key,
              application: "Milodo",
              event: "Kundenanforderung",
              description: `${customerRow.name} • ${title} • ${when}`,
            }).toString(),
          }).catch(() => null);
        }),
      );
    } catch {
      // ignore
    }
  }

  // generate Dienst-PDF
  try {
    const pdf = await buildServicePdf({
      title,
      serviceType,
      startAt,
      endAt,
      customerName: customerRow.name,
      customerContact: customerRow.contactName,
      customerAddress: customerAddrFull,
      customerMail: customerRow.email,
      customerPhone: customerRow.phone,
      locationName,
      locationAddress: locationAddrFull,
      notes: String(body.notes ?? ""),
      visitors: body.visitors ?? null,
      participants: Array.isArray(body.participants) ? body.participants : [],
      requirements: reqs.map((r) => ({ minCount: Math.max(1, Math.round(Number(r.minCount ?? 1))), value: String(r.value ?? "").trim() })).filter((r) => r.value),
      assets: Array.isArray(body.assets) ? body.assets.map((a) => ({ count: Math.max(1, Math.round(Number(a.count ?? 1))), item: String(a.item ?? "").trim() })).filter((a) => a.item) : [],
    });

    const fileName = safeFileName(`${title}.pdf`);
    const storedName = `${appointmentId}-${fileName}`;
    const storageKey = `Dienste/${storedName}`;

    if (await isSftpEnabled()) {
      await withSftp(async (client, basePath) => {
        await client.mkdir(buildServicesDir(basePath), true);
        await client.put(pdf, buildServiceRemoteFilePath(basePath, storedName));
        return true;
      });
    } else {
      // If SFTP is off, we still store nowhere for now.
    }

    await db.insert(appointmentFiles).values({
      appointmentId,
      fileName,
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: pdf.byteLength,
    });
  } catch {
    // ignore PDF generation errors for now
  }

  return NextResponse.json({ ok: true, id: appointmentId });
}
