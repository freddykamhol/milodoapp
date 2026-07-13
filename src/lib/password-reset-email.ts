import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}) {
  const text = `Hallo!\n\nSetze dein Passwort über diesen Link:\n${resetUrl}\n\nWenn du das nicht angefordert hast, ignoriere diese Mail.`;
  const html = buildEmailHtml({
    preheader: "Passwort zurücksetzen",
    title: "Passwort zurücksetzen",
    intro: "Klicke auf den Button, um ein neues Passwort zu setzen.",
    button: { label: "Neues Passwort setzen", url: resetUrl },
    footerNote: "Der Link ist zeitlich begrenzt gültig.",
  });

  const result = await sendSmtpMail({ to, subject: "[Milodo] Passwort zurücksetzen", text, html });
  return result.ok ? { ok: true as const } : { ...result, message: "" };
}
