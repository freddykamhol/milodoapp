import nodemailer from "nodemailer";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { smtpSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";

async function ensureSmtpRow() {
  await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function sendWelcomeEmail({
  to,
  username,
  passwordPlain,
}: {
  to: string;
  username: string;
  passwordPlain: string;
}) {
  await ensureSmtpRow();
  const row = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row?.enabled) return { ok: false as const, error: "smtp_disabled" as const, message: "" };
  if (!row.host || !row.port) return { ok: false as const, error: "smtp_incomplete" as const, message: "" };
  const fromEmail = row.fromEmail?.trim() || (row.username?.includes("@") ? row.username.trim() : "");
  if (!fromEmail) return { ok: false as const, error: "smtp_from_missing" as const, message: "" };

  const text = `Hallo!\n\nDein Account wurde angelegt.\n\nUsername: ${username}\nPasswort: ${passwordPlain}\n\nBitte ändere dein Passwort nach dem ersten Login.\n\nWenn du das nicht angefordert hast, ignoriere diese Mail.`;
  const html = buildEmailHtml({
    preheader: "Dein Milodo Account ist bereit.",
    title: "Willkommen bei Milodo",
    intro: "Dein Account wurde angelegt. Du kannst dich jetzt einloggen.",
    sections: [
      { label: "Username", value: username },
      { label: "Passwort", value: passwordPlain },
    ],
    footerNote: "Sicherheitshinweis: Bitte ändere dein Passwort nach dem ersten Login.",
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

  await transporter.sendMail({ from: fromEmail, to, subject: "[Milodo] Willkommen", text, html });
  return { ok: true as const };
}
