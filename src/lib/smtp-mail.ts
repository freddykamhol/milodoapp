import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

import { smtpSettings } from "@/db/schema";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";

export const SMTP_FROM_NAME = "MILODO Medical Group";

async function ensureSmtpRow() {
  await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
}

export type SmtpConfig = typeof smtpSettings.$inferSelect & {
  fromEmail: string;
};

export async function getSmtpConfig() {
  await ensureSmtpRow();
  const row = await db.query.smtpSettings.findFirst({ where: (table, { eq }) => eq(table.id, 1) });
  if (!row?.enabled) return { ok: false as const, error: "smtp_disabled" as const };
  if (!row.host || !row.port) return { ok: false as const, error: "smtp_incomplete" as const };

  const fromEmail = row.fromEmail?.trim() || (row.username?.includes("@") ? row.username.trim() : "");
  if (!fromEmail) return { ok: false as const, error: "smtp_from_missing" as const };

  return { ok: true as const, config: { ...row, fromEmail } };
}

export function createSmtpTransporter(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: Boolean(config.secure),
    auth: config.username ? { user: config.username, pass: decryptSecret(config.password) } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
}

function collectEnvelopeRecipients(value: Mail.Options["to"] | Mail.Options["cc"] | Mail.Options["bcc"]) {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries
    .map((entry) => (typeof entry === "string" ? entry : entry.address))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function sendSmtpMail(message: Omit<Mail.Options, "from" | "sender" | "envelope">) {
  const smtp = await getSmtpConfig();
  if (!smtp.ok) return smtp;

  const transporter = createSmtpTransporter(smtp.config);
  const envelopeRecipients = [
    ...collectEnvelopeRecipients(message.to),
    ...collectEnvelopeRecipients(message.cc),
    ...collectEnvelopeRecipients(message.bcc),
  ];

  await transporter.sendMail({
    ...message,
    from: { name: SMTP_FROM_NAME, address: smtp.config.fromEmail },
    sender: smtp.config.fromEmail,
    envelope: {
      from: smtp.config.fromEmail,
      to: envelopeRecipients,
    },
    headers: {
      "X-Auto-Response-Suppress": "All",
      ...(message.headers ?? {}),
    },
  });

  return { ok: true as const };
}
