import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

export async function sendReportConfirmationEmail({
  to,
  appointmentTitle,
  appointmentWhen,
  appointmentUrl,
}: {
  to: string;
  appointmentTitle: string;
  appointmentWhen: string;
  appointmentUrl: string;
}) {
  const text = `Bestätigung: Du hast dich gemeldet.\n\n${appointmentTitle}\n${appointmentWhen}\n\nDetails: ${appointmentUrl}`;
  const html = buildEmailHtml({
    preheader: "Bestätigung deiner Meldung",
    title: "Meldung bestätigt",
    intro: "Du hast dich erfolgreich für folgenden Dienst gemeldet:",
    sections: [
      { label: "Dienst", value: appointmentTitle },
      { label: "Zeit", value: appointmentWhen },
    ],
    button: { label: "Zum Dienst", url: appointmentUrl },
  });

  const result = await sendSmtpMail({ to, subject: "[Milodo] Meldung bestätigt", text, html });
  return result.ok ? { ok: true as const } : { ...result, message: "" };
}
