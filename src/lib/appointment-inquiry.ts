import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";
import { sendTelegramMessage } from "@/lib/telegram";
import { getAppUrl } from "@/lib/app-url";
import {
  appointmentRequirements,
  notificationPrefs,
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
  const fmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  if (!endAt) return fmt.format(startAt);
  const timeFmt = new Intl.DateTimeFormat("de-DE", { timeStyle: "short" });
  return `${fmt.format(startAt)}–${timeFmt.format(endAt)}`;
}

function serviceTypeLabel(value: string) {
  if (value === "RD_BOERSE") return "Rettungsdienst-Börse";
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
  appointmentId,
  title,
  startAt,
  endAt,
  reqLabel,
  sections,
}: {
  prefKey: "URGENT_REQUESTS" | "REQUESTS_GENERAL";
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
    .select({ email: users.email })
    .from(notificationPrefs)
    .innerJoin(users, eq(notificationPrefs.userId, users.id))
    .where(and(eq(notificationPrefs.key, prefKey), eq(notificationPrefs.emailEnabled, true)));

  const emails = Array.from(new Set(targetRows.map((r) => String(r.email || "").trim()).filter(Boolean)));
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
  title,
  startAt,
  endAt,
  reqLabel,
}: {
  prefKey: "URGENT_REQUESTS" | "REQUESTS_GENERAL";
  title: string;
  startAt: Date;
  endAt: Date | null;
  reqLabel: string;
}) {
  const when = formatInquiryTimeRange(startAt, endAt);
  const event = prefKey === "URGENT_REQUESTS" ? "AKUTE ABFRAGE" : "Dienstabfrage";
  const description = `${title} • ${when}\n${reqLabel}`;

  const keys = await db
    .select({ apiKey: prowlKeys.apiKey })
    .from(prowlKeys)
    .innerJoin(notificationPrefs, eq(notificationPrefs.userId, prowlKeys.userId))
    .where(
      and(
        eq(prowlKeys.enabled, true),
        eq(notificationPrefs.key, prefKey),
        eq(notificationPrefs.emailEnabled, true),
      ),
    )
    .limit(25);

  await Promise.all(
    keys.map(async (k) => {
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
    .select({ minCount: appointmentRequirements.minCount, value: appointmentRequirements.value })
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
