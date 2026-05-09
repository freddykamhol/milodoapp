import nodemailer from "nodemailer";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { smtpSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";

async function ensureSmtpRow() {
  await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function sendPersonalfragebogenConfirmationEmail({
  to,
  questionnaireId,
  pdfBytes,
}: {
  to: string;
  questionnaireId: number;
  pdfBytes: Uint8Array;
}) {
  await ensureSmtpRow();
  const row = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row?.enabled) return { ok: false as const, error: "smtp_disabled" as const };
  if (!row.host || !row.port) return { ok: false as const, error: "smtp_incomplete" as const };
  const fromEmail = row.fromEmail?.trim() || (row.username?.includes("@") ? row.username.trim() : "");
  if (!fromEmail) return { ok: false as const, error: "smtp_from_missing" as const };

  const subject = "[MILODO] Bestätigung Personalfragebogen";
  const intro =
    "Vielen Dank! Wir bestätigen den Erhalt deines Personalfragebogens.\n\nIm Anhang findest du eine PDF-Kopie deiner Angaben.";
  const text = `${intro}\n\nReferenz: #${questionnaireId}\n\nMILODO medical`;
  const html = buildEmailHtml({
    preheader: `Bestätigung Erhalt #${questionnaireId}`,
    title: "Bestätigung: Personalfragebogen erhalten",
    intro,
    sections: [{ label: "Referenz", value: `#${questionnaireId}` }],
    footerNote: "Bei Fragen antworte einfach auf diese E‑Mail oder melde dich bei uns.",
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

  const attachmentName = `Personalfragebogen-Honorar-${questionnaireId}.pdf`;

  await transporter.sendMail({
    from: fromEmail,
    to,
    subject,
    text,
    html,
    attachments: [{ filename: attachmentName, content: Buffer.from(pdfBytes), contentType: "application/pdf" }],
  });

  return { ok: true as const };
}
