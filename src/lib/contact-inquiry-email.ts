import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";
import path from "node:path";

// Temporärer BCC: entfernen, sobald die Übergangsphase beendet ist.

export async function sendContactInquiryEmail(props: {
  to: string[];
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
    logoCid: "milodo-logo@milodo-medical.de",
    footerNote: "Diese E‑Mail wurde automatisch erstellt.",
  });

  return sendSmtpMail({
    to: props.to[0],
    bcc: props.to.slice(1),
    subject: props.subject,
    text,
    html,
    attachments: [
      {
        filename: "milodo-logo.png",
        path: path.join(process.cwd(), "public", "logo", "MILODO.png"),
        cid: "milodo-logo@milodo-medical.de",
        contentDisposition: "inline",
      },
    ],
  });
}
