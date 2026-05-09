import nodemailer from "nodemailer";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { smtpSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";

async function ensureSmtpRow() {
  await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function sendReportConfirmationEmail({
  to,
  appointmentTitle,
  appointmentWhen,
  appointmentUrl,
}: {
  to: string;
  appointmentTitle: string;
  appointmentWhen: string;
  appointmentUrl: string;
}) {
  await ensureSmtpRow();
  const row = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row?.enabled) return { ok: false as const, error: "smtp_disabled" as const, message: "" };
  if (!row.host || !row.port) return { ok: false as const, error: "smtp_incomplete" as const, message: "" };
  const fromEmail = row.fromEmail?.trim() || (row.username?.includes("@") ? row.username.trim() : "");
  if (!fromEmail) return { ok: false as const, error: "smtp_from_missing" as const, message: "" };

  const text = `Bestätigung: Du hast dich gemeldet.\n\n${appointmentTitle}\n${appointmentWhen}\n\nDetails: ${appointmentUrl}`;
  const html = buildEmailHtml({
    preheader: "Bestätigung deiner Meldung",
    title: "Meldung bestätigt",
    intro: "Du hast dich erfolgreich für folgenden Dienst gemeldet:",
    sections: [
      { label: "Dienst", value: appointmentTitle },
      { label: "Zeit", value: appointmentWhen },
    ],
    button: { label: "Zum Dienst", url: appointmentUrl },
  });

  const transporter = nodemailer.createTransport({
    host: row.host,
    port: row.port,
    secure: Boolean(row.secure),
    auth: row.username ? { user: row.username, pass: decryptSecret(row.password) } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  await transporter.sendMail({ from: fromEmail, to, subject: "[Milodo] Meldung bestätigt", text, html });
  return { ok: true as const };
}
