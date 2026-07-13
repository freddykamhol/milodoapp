import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

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

  const intro = "Neue Kontaktanfrage über die Website.";
  const text = `${intro}\n\n${props.sections.map((s) => `${s.label}: ${s.value}`).join("\n")}\n\nMilodo`;
  const html = buildEmailHtml({
    preheader: props.preheader ?? "Neue Kontaktanfrage",
    title: props.subject,
    intro,
    sections: props.sections,
    footerNote: "Diese E‑Mail wurde automatisch erstellt.",
  });

  return sendSmtpMail({ to, subject: props.subject, text, html });
}
