import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

export async function sendWelcomeEmail({
  to,
  username,
  passwordPlain,
}: {
  to: string;
  username: string;
  passwordPlain: string;
}) {
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

  const result = await sendSmtpMail({ to, subject: "[Milodo] Willkommen", text, html });
  return result.ok ? { ok: true as const } : { ...result, message: "" };
}
