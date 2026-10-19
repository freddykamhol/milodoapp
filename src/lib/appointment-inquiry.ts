import { dateFormatter } from "@/lib/date-format";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";
import { sendTelegramMessage } from "@/lib/telegram";
import { getAppUrl } from "@/lib/app-url";
import { isInquiryServiceEnabled } from "@/lib/inquiry-service-types";
import { matchesAppointmentRequirements } from "@/lib/qual-hierarchy";
import {
  appointmentRequirements,
  notificationPrefs,
  notifications,
  prowlKeys,
  users,
} from "@/db/schema";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildRequirementsLabel(reqs: Array<{ minCount: number; value: string }>) {
  const clean = reqs
    .map((r) => ({
      minCount: Math.max(1, Math.round(Number(r.minCount || 1))),
      value: String(r.value || "").trim(),
    }))
    .filter((r) => r.value);
  if (!clean.length) return "Angefordertes Personal: —";
  return `Angefordertes Personal: ${clean.map((r) => `mind. ${r.minCount}× ${r.value}`).join(" • ")}`;
}

function formatInquiryTimeRange(startAt: Date, endAt: Date | null) {
  const fmt = dateFormatter({ dateStyle: "medium", timeStyle: "short" });
  if (!endAt) return fmt.format(startAt);
  const timeFmt = dateFormatter({ timeStyle: "short" });
  return `${fmt.format(startAt)}–${timeFmt.format(endAt)}`;
}

function serviceTypeLabel(value: string) {
  if (value === "RD_BOERSE") return "RD-Personalvermittlung";
  if (value === "SANITATSDIENST") return "Sanitätsdienst";
  return "Erste Hilfe";
}

type InquiryDetails = {
  visitors?: unknown;
  assets?: Array<{ count?: unknown; item?: unknown }>;
  participants?: unknown[];
  notes?: unknown;
};

function listLabel<T>(items: unknown, render: (item: T) => string) {
  return Array.isArray(items) ? items.map(render).filter(Boolean).join("\n") || "—" : "—";
}

async function sendInquiryTelegram({
  kind,
  appointmentId,
  title,
  startAt,
  endAt,
  reqLabel,
}: {
  kind: "URGENT_REQUESTS" | "REQUESTS_GENERAL";
  appointmentId: number;
  title: string;
  startAt: Date;
  endAt: Date | null;
  reqLabel: string;
}) {
  const when = formatInquiryTimeRange(startAt, endAt);
  const appUrl = `${getAppUrl()}/appointments/${appointmentId}`;

  const header =
  kind === "URGENT_REQUESTS"
      ? "<b>AKUTE ABFRAGE</b>"
      : "Hallo zusammen!\nWir suchen für einen Dienst Personal:";

  const text = `${header}\n\n<b>${escapeHtml(title)}</b>\n${escapeHtml(when)}\n${escapeHtml(reqLabel)}`;

  const result = await sendTelegramMessage({
    text,
    parseMode: "HTML",
    button: { text: "Direkt zum Dienst", url: appUrl },
    kind,
  });
  if (!result.ok) throw new Error(`telegram:${result.error}:${result.message}`);
}

async function sendInquiryEmail({
  prefKey,
  bereich,
  dienstart,
  requirements,
  appointmentId,
  title,
  startAt,
  endAt,
  reqLabel,
  sections,
}: {
  prefKey: "URGENT_REQUESTS" | "REQUESTS_GENERAL";
  bereich: "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";
  dienstart: string | null;
  requirements: Array<{ kind: string; value: string }>;
  appointmentId: number;
  title: string;
  startAt: Date;
  endAt: Date | null;
  reqLabel: string;
  sections: Array<{ label: string; value: string }>;
}) {
  const when = formatInquiryTimeRange(startAt, endAt);
  const url = `${getAppUrl()}/appointments/${appointmentId}`;
  const subject = prefKey === "URGENT_REQUESTS" ? "[Milodo] AKUTE ABFRAGE" : "[Milodo] DIENSTABFRAGE";
  const preheader = `${title} • ${when}`;

  const targetRows = await db
    .select({ email: users.email, inquiryServiceTypes: users.inquiryServiceTypes, role: users.role, qualRD: users.qualRD, qualAusb: users.qualAusb })
    .from(notificationPrefs)
    .innerJoin(users, eq(notificationPrefs.userId, users.id))
    .where(and(eq(notificationPrefs.key, prefKey), eq(notificationPrefs.emailEnabled, true)));

  const emails = Array.from(new Set(targetRows
    .filter((row) => isInquiryServiceEnabled(row.inquiryServiceTypes, bereich, dienstart)
      && matchesAppointmentRequirements(row, requirements))
    .map((r) => String(r.email || "").trim())
    .filter(Boolean)));
  for (const to of emails) {
    const text = `${subject.replace(/^\[Milodo\]\s*/, "")}\n\n${sections.map((s) => `${s.label}: ${s.value}`).filter(Boolean).join("\n")}\n\nDirekt zum Dienst: ${url}`;
    const html = buildEmailHtml({
      preheader,
      title: subject.replace(/^\[Milodo\]\s*/, ""),
      intro: "Wir suchen Personal für folgenden Dienst:",
      sections,
      button: { label: "Direkt zum Dienst", url },
    });
    const result = await sendSmtpMail({
      to,
      subject,
      text,
      html,
    });
    if (!result.ok) return { skipped: true as const, reason: result.error };
  }

  return { skipped: false as const };
}

async function sendInquiryProwl({
  prefKey,
  bereich,
  dienstart,
  requirements,
  title,
  startAt,
  endAt,
  reqLabel,
}: {
  prefKey: "URGENT_REQUESTS" | "REQUESTS_GENERAL";
  bereich: "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";
  dienstart: string | null;
  requirements: Array<{ kind: string; value: string }>;
  title: string;
  startAt: Date;
  endAt: Date | null;
  reqLabel: string;
}) {
  const when = formatInquiryTimeRange(startAt, endAt);
  const event = prefKey === "URGENT_REQUESTS" ? "AKUTE ABFRAGE" : "Dienstabfrage";
  const description = `${title} • ${when}\n${reqLabel}`;

  const keys = await db
    .select({ apiKey: prowlKeys.apiKey, inquiryServiceTypes: users.inquiryServiceTypes, role: users.role, qualRD: users.qualRD, qualAusb: users.qualAusb })
    .from(prowlKeys)
    .innerJoin(users, eq(prowlKeys.userId, users.id))
    .innerJoin(notificationPrefs, eq(notificationPrefs.userId, prowlKeys.userId))
    .where(
      and(
        eq(prowlKeys.enabled, true),
        eq(notificationPrefs.key, prefKey),
        eq(notificationPrefs.emailEnabled, true),
      ),
    );

  await Promise.all(
    keys.filter((key) => isInquiryServiceEnabled(key.inquiryServiceTypes, bereich, dienstart)
      && matchesAppointmentRequirements(key, requirements)).slice(0, 25).map(async (k) => {
      const key = String(k.apiKey || "").trim();
      if (!key) return;
      const res = await fetch("https://api.prowlapp.com/publicapi/add", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          apikey: key,
          application: "Milodo",
          event,
          description,
        }).toString(),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`prowl_failed:${res.status}:${msg.slice(0, 400)}`);
      }
    }),
  );
}

type InquiryChannelResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; error: string; message?: string };

export type AppointmentInquiryResult = {
  telegram: InquiryChannelResult;
  email: InquiryChannelResult;
  prowl: InquiryChannelResult;
  anyOk: boolean;
};

export async function createAppointmentInquiryNotifications(
  appointmentId: number,
  kind: "URGENT_REQUESTS" | "REQUESTS_GENERAL",
) {
  const appointment = await db.query.appointments.findFirst({
    where: (table, { eq: equals }) => equals(table.id, appointmentId),
    columns: { id: true, title: true, startAt: true, bereich: true, dienstart: true },
  });
  if (!appointment) return;

  const recipients = await db.select({
    id: users.id,
    inquiryServiceTypes: users.inquiryServiceTypes,
    role: users.role,
    qualRD: users.qualRD,
    qualAusb: users.qualAusb,
  })
    .from(users)
    .where(ne(users.role, "KUNDE"));
  const requirements = await db.select({ kind: appointmentRequirements.kind, value: appointmentRequirements.value })
    .from(appointmentRequirements)
    .where(eq(appointmentRequirements.appointmentId, appointmentId));
  const eligible = recipients.filter((user) => isInquiryServiceEnabled(
    user.inquiryServiceTypes,
    appointment.bereich,
    appointment.dienstart,
  ) && matchesAppointmentRequirements(user, requirements));
  if (!eligible.length) return;

  await db.insert(notifications).values(eligible.map((user) => ({
    scope: "USER" as const,
    userId: user.id,
    kind,
    title: kind === "URGENT_REQUESTS" ? "AKUTE ABFRAGE" : "Dienstabfrage",
    body: `${appointment.title}\n${dateFormatter({ dateStyle: "medium", timeStyle: "short" }).format(appointment.startAt)}`,
    href: `/appointments/${appointment.id}`,
  })));
}

export async function triggerAppointmentInquiry(
  appointmentId: number,
  kind: "URGENT_REQUESTS" | "REQUESTS_GENERAL",
): Promise<AppointmentInquiryResult> {
  const appointment = await db.query.appointments.findFirst({
    where: (t, { eq }) => eq(t.id, appointmentId),
    columns: { id: true, title: true, startAt: true, endAt: true, bereich: true, dienstart: true, eventName: true, notes: true, einsatzort: true, detailsJson: true },
    with: { customer: { columns: { name: true, contactName: true, street: true, houseNumber: true, plz: true, city: true, email: true, phone: true } } },
  });
  if (!appointment) throw new Error("not_found");

  const reqs = await db
    .select({ minCount: appointmentRequirements.minCount, kind: appointmentRequirements.kind, value: appointmentRequirements.value })
    .from(appointmentRequirements)
    .where(eq(appointmentRequirements.appointmentId, appointmentId));

  const reqLabel = buildRequirementsLabel(reqs.map((r) => ({ minCount: r.minCount, value: r.value })));
  let details: InquiryDetails = {};
  try {
    details = JSON.parse(appointment.detailsJson || "{}") as InquiryDetails;
  } catch {
    details = {};
  }
  const customer = appointment.customer;
  const customerAddress = [customer?.street, customer?.houseNumber].filter(Boolean).join(" ");
  const customerCity = [customer?.plz, customer?.city].filter(Boolean).join(" ");
  const sections = [
    { label: "Anfrageart", value: kind === "URGENT_REQUESTS" ? "AKUTE ABFRAGE" : "DIENSTABFRAGE" },
    { label: "Bereich", value: serviceTypeLabel(appointment.bereich) },
    { label: "Veranstaltung / Dienst", value: appointment.eventName || appointment.title },
    { label: "RD-Dienstart", value: appointment.dienstart === "S_RTW" ? "S-RTW" : appointment.dienstart || "" },
    { label: "Zeit", value: formatInquiryTimeRange(appointment.startAt, appointment.endAt ?? null) },
    { label: "Kunde", value: customer?.name || "" },
    { label: "Ansprechpartner", value: customer?.contactName || "" },
    { label: "Kundenadresse", value: [customerAddress, customerCity].filter(Boolean).join(", ") },
    { label: "Kunden-E-Mail", value: customer?.email || "" },
    { label: "Kunden-Telefon", value: customer?.phone || "" },
    { label: "Einsatzort", value: appointment.einsatzort },
    { label: "Besucherzahl", value: details.visitors == null ? "" : String(details.visitors) },
    { label: "Anforderung", value: reqLabel.replace(/^Angefordertes Personal:\s*/, "") },
    { label: "Material / Fahrzeuge", value: listLabel<{ count?: unknown; item?: unknown }>(details.assets, (a) => `${a.count}× ${a.item}`) },
    { label: "Teilnehmer", value: listLabel<unknown>(details.participants, (p) => String(p).trim()) },
    { label: "Bemerkung", value: appointment.notes || String(details.notes || "") },
  ];

  const base = {
    appointmentId,
    bereich: appointment.bereich,
    dienstart: appointment.dienstart ?? null,
    requirements: reqs.map(({ kind: requirementKind, value }) => ({ kind: requirementKind, value })),
    title: appointment.title,
    startAt: appointment.startAt,
    endAt: appointment.endAt ?? null,
    reqLabel,
    sections,
  };

  async function runTelegram(): Promise<InquiryChannelResult> {
    try {
      await sendInquiryTelegram({ kind, ...base });
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "telegram_failed";
      return { ok: false, error: "telegram_failed", message: msg };
    }
  }

  async function runEmail(): Promise<InquiryChannelResult> {
    try {
      const res = await sendInquiryEmail({ prefKey: kind, ...base });
      if (res?.skipped) return { ok: false, skipped: true, error: res.reason };
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "email_failed";
      return { ok: false, error: "email_failed", message: msg };
    }
  }

  async function runProwl(): Promise<InquiryChannelResult> {
    try {
      await sendInquiryProwl({ prefKey: kind, ...base });
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "prowl_failed";
      return { ok: false, error: "prowl_failed", message: msg };
    }
  }

  const [telegram, email, prowl] = await Promise.all([runTelegram(), runEmail(), runProwl()]);
  const anyOk = [telegram, email, prowl].some((r) => r.ok);
  return { telegram, email, prowl, anyOk };
}
