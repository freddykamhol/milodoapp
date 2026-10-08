import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

const CONTACT_INQUIRY_TO = "anfrage@milodo-medical.de";
// Temporärer BCC: entfernen, sobald die Übergangsphase beendet ist.
const CONTACT_INQUIRY_BCC = "f.karamazmy@katechnologies.de";

export async function sendContactInquiryEmail(props: {
  subject: string;
  sections: Array<{ label: string; value: string }>;
  preheader?: string;
}) {
  const intro = "Neue Kontaktanfrage über die Website.";
  const text = `${intro}\n\n${props.sections.map((s) => `${s.label}: ${s.value}`).join("\n")}\n\nMilodo`;
  const html = buildEmailHtml({
    preheader: props.preheader ?? "Neue Kontaktanfrage",
    title: props.subject,
    intro,
    sections: props.sections,
    footerNote: "Diese E‑Mail wurde automatisch erstellt.",
  });

  return sendSmtpMail({
    to: CONTACT_INQUIRY_TO,
    bcc: CONTACT_INQUIRY_BCC,
    subject: props.subject,
    text,
    html,
  });
}
