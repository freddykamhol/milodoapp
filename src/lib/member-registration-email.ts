import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

export async function sendMemberRegistrationApprovedEmail({
  to,
  username,
}: {
  to: string;
  username: string;
}) {
  const text = `Hallo!\n\nDein Milodo Account wurde bestätigt und ist jetzt aktiv.\n\nUsername: ${username}\n\nDu kannst dich mit dem Passwort anmelden, das du bei der Registrierung vergeben hast.`;
  const html = buildEmailHtml({
    preheader: "Dein Milodo Account wurde bestätigt.",
    title: "Registrierung bestätigt",
    intro: "Dein Account wurde freigegeben und ist jetzt aktiv.",
    sections: [{ label: "Username", value: username }],
    footerNote: "Du kannst dich mit dem Passwort anmelden, das du bei der Registrierung vergeben hast.",
  });

  return sendSmtpMail({ to, subject: "[Milodo] Registrierung bestätigt", text, html });
}
