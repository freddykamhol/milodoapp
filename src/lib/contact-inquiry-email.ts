import nodemailer from "nodemailer";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { smtpSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";

async function ensureSmtpRow() {
  await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
}

function requiredToEmail() {
  const to = String(process.env.CONTACT_INQUIRY_TO_EMAIL ?? "").trim();
  return to || null;
}

export async function sendContactInquiryEmail(props: {
  subject: string;
  sections: Array<{ label: string; value: string }>;
  preheader?: string;
}) {
  const to = requiredToEmail();
  if (!to) return { ok: false as const, error: "to_missing" as const };

  await ensureSmtpRow();
  const row = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row?.enabled) return { ok: false as const, error: "smtp_disabled" as const };
  if (!row.host || !row.port) return { ok: false as const, error: "smtp_incomplete" as const };
  const fromEmail = row.fromEmail?.trim() || (row.username?.includes("@") ? row.username.trim() : "");
  if (!fromEmail) return { ok: false as const, error: "smtp_from_missing" as const };

  const intro = "Neue Kontaktanfrage über die Website.";
  const text = `${intro}\n\n${props.sections.map((s) => `${s.label}: ${s.value}`).join("\n")}\n\nMilodo`;
  const html = buildEmailHtml({
    preheader: props.preheader ?? "Neue Kontaktanfrage",
    title: props.subject,
    intro,
    sections: props.sections,
    footerNote: "Diese E‑Mail wurde automatisch erstellt.",
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

  await transporter.sendMail({ from: fromEmail, to, subject: props.subject, text, html });
  return { ok: true as const };
}
