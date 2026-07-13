import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

export async function sendCustomEmail({
  to,
  subject,
  message,
  attachments,
}: {
  to: string;
  subject: string;
  message: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}) {
  const text = message.trim();
  const html = buildEmailHtml({
    preheader: subject,
    title: subject,
    intro: text,
    footerNote: "Wenn du diese Nachricht unerwartet erhalten hast, kannst du sie ignorieren.",
  });

  const result = await sendSmtpMail({ to, subject, text, html, attachments });
  return result.ok ? { ok: true as const } : { ...result, message: "" };
}
