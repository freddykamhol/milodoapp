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
}: {
  prefKey: "URGENT_REQUESTS" | "REQUESTS_GENERAL";
  appointmentId: number;
  title: string;
  startAt: Date;
  endAt: Date | null;
  reqLabel: string;
}) {
  const when = formatInquiryTimeRange(startAt, endAt);
  const url = `${getAppUrl()}/appointments/${appointmentId}`;
  const subject = prefKey === "URGENT_REQUESTS" ? "[Milodo] AKUTE ABFRAGE" : "[Milodo] Dienstabfrage";
  const preheader = `${title} • ${when}`;

  const targetRows = await db
    .select({ email: users.email })
    .from(notificationPrefs)
    .innerJoin(users, eq(notificationPrefs.userId, users.id))
    .where(and(eq(notificationPrefs.key, prefKey), eq(notificationPrefs.emailEnabled, true)));

  const emails = Array.from(new Set(targetRows.map((r) => String(r.email || "").trim()).filter(Boolean)));
  for (const to of emails) {
    const text = `${title}\n${when}\n${reqLabel}\n\nDirekt zum Dienst: ${url}`;
    const html = buildEmailHtml({
      preheader,
      title: subject.replace(/^\[Milodo\]\s*/, ""),
      intro: "Wir suchen Personal für folgenden Dienst:",
      sections: [
        { label: "Dienst", value: title },
        { label: "Zeit", value: when },
        { label: "Anforderung", value: reqLabel },
      ],
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
    columns: { id: true, title: true, startAt: true, endAt: true },
  });
  if (!appointment) throw new Error("not_found");

  const reqs = await db
    .select({ minCount: appointmentRequirements.minCount, value: appointmentRequirements.value })
    .from(appointmentRequirements)
    .where(eq(appointmentRequirements.appointmentId, appointmentId));

  const reqLabel = buildRequirementsLabel(reqs.map((r) => ({ minCount: r.minCount, value: r.value })));

  const base = {
    appointmentId,
    title: appointment.title,
    startAt: appointment.startAt,
    endAt: appointment.endAt ?? null,
    reqLabel,
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
