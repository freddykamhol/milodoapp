import nodemailer from "nodemailer";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { smtpSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";

async function ensureSmtpRow() {
  await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function sendNotificationEmail({
  to,
  subject,
  preheader,
  title,
  intro,
  sections = [],
  button,
  footerNote,
}: {
  to: string;
  subject: string;
  preheader: string;
  title: string;
  intro: string;
  sections?: Array<{ label: string; value: string }>;
  button?: { label: string; url: string };
  footerNote?: string;
}) {
  await ensureSmtpRow();
  const row = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row?.enabled) return { ok: false as const, skipped: true as const, reason: "smtp_disabled" as const };
  if (!row.host || !row.port) return { ok: false as const, skipped: true as const, reason: "smtp_incomplete" as const };
  const fromEmail = row.fromEmail?.trim() || (row.username?.includes("@") ? row.username.trim() : "");
  if (!fromEmail) return { ok: false as const, skipped: true as const, reason: "smtp_from_missing" as const };

  const html = buildEmailHtml({ preheader, title, intro, sections, button, footerNote });
  const text = [
    title,
    "",
    intro,
    "",
    ...sections.map((s) => `${s.label}: ${s.value}`),
    button?.url ? `\n${button.url}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const transporter = nodemailer.createTransport({
    host: row.host,
    port: row.port,
    secure: Boolean(row.secure),
    auth: row.username ? { user: row.username, pass: decryptSecret(row.password) } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  await transporter.sendMail({ from: fromEmail, to, subject, text, html });
  return { ok: true as const };
}
