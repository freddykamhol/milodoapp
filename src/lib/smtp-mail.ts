import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import crypto from "node:crypto";

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
  const dkimDomain = String(process.env.SMTP_DKIM_DOMAIN ?? "").trim();
  const dkimSelector = String(process.env.SMTP_DKIM_SELECTOR ?? "").trim();
  const dkimPrivateKey = String(process.env.SMTP_DKIM_PRIVATE_KEY ?? "")
    .replaceAll("\\n", "\n")
    .trim();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: Boolean(config.secure),
    auth: config.username ? { user: config.username, pass: decryptSecret(config.password) } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    dkim:
      dkimDomain && dkimSelector && dkimPrivateKey
        ? {
            domainName: dkimDomain,
            keySelector: dkimSelector,
            privateKey: dkimPrivateKey,
          }
        : undefined,
  });
}

function emailDomain(email: string) {
  return email.split("@").at(1)?.trim().toLowerCase() || "";
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
  const fromDomain = emailDomain(smtp.config.fromEmail);
  const messageId = fromDomain
    ? `<${crypto.randomBytes(16).toString("hex")}@${fromDomain}>`
    : undefined;

  if (!envelopeRecipients.length) {
    return { ok: false as const, error: "smtp_recipient_missing" as const };
  }

  try {
    const info = await transporter.sendMail({
      ...message,
      from: { name: SMTP_FROM_NAME, address: smtp.config.fromEmail },
      sender: smtp.config.fromEmail,
      replyTo: message.replyTo ?? smtp.config.fromEmail,
      messageId: message.messageId ?? messageId,
      envelope: {
        from: smtp.config.fromEmail,
        to: envelopeRecipients,
      },
      headers: {
        "X-Auto-Response-Suppress": "All",
        ...(message.headers ?? {}),
      },
    });

    const accepted = (info.accepted ?? []).map(String);
    const rejected = (info.rejected ?? []).map(String);
    if (rejected.length || !accepted.length) {
      console.error("SMTP server rejected recipients", {
        messageId: info.messageId,
        accepted,
        rejected,
        response: info.response,
      });
      return {
        ok: false as const,
        error: "smtp_rejected" as const,
        accepted,
        rejected,
        response: String(info.response ?? ""),
      };
    }

    return { ok: true as const, messageId: String(info.messageId ?? messageId ?? ""), accepted };
  } finally {
    transporter.close();
  }
}
