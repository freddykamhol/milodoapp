import nodemailer from "nodemailer";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { smtpSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";

async function ensureSmtpRow() {
  await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}) {
  await ensureSmtpRow();
  const row = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row?.enabled) return { ok: false as const, error: "smtp_disabled" as const, message: "" };
  if (!row.host || !row.port) return { ok: false as const, error: "smtp_incomplete" as const, message: "" };
  const fromEmail = row.fromEmail?.trim() || (row.username?.includes("@") ? row.username.trim() : "");
  if (!fromEmail) return { ok: false as const, error: "smtp_from_missing" as const, message: "" };

  const text = `Hallo!\n\nSetze dein Passwort über diesen Link:\n${resetUrl}\n\nWenn du das nicht angefordert hast, ignoriere diese Mail.`;
  const html = buildEmailHtml({
    preheader: "Passwort zurücksetzen",
    title: "Passwort zurücksetzen",
    intro: "Klicke auf den Button, um ein neues Passwort zu setzen.",
    button: { label: "Neues Passwort setzen", url: resetUrl },
    footerNote: "Der Link ist zeitlich begrenzt gültig.",
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

  await transporter.sendMail({ from: fromEmail, to, subject: "[Milodo] Passwort zurücksetzen", text, html });
  return { ok: true as const };
}
