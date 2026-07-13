import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

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

  const result = await sendSmtpMail({ to, subject, text, html });
  return result.ok ? { ok: true as const } : { ok: false as const, skipped: true as const, reason: result.error };
}
