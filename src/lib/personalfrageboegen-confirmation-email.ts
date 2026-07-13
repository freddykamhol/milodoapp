import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

export async function sendPersonalfragebogenConfirmationEmail({
  to,
  questionnaireId,
  pdfBytes,
}: {
  to: string;
  questionnaireId: number;
  pdfBytes: Uint8Array;
}) {
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

  const attachmentName = `Personalfragebogen-Honorar-${questionnaireId}.pdf`;

  return sendSmtpMail({
    to,
    subject,
    text,
    html,
    attachments: [{ filename: attachmentName, content: Buffer.from(pdfBytes), contentType: "application/pdf" }],
  });
}
