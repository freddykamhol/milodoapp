import { buildEmailHtml } from "@/lib/email";
import { sendSmtpMail } from "@/lib/smtp-mail";

export async function sendMemberRegistrationReceivedEmail({
  to,
  username,
}: {
  to: string;
  username: string;
}) {
  const text = `Hallo!

vielen Dank für deine Registrierung bei Milodo.

Dein Benutzername: ${username}

Deine Angaben wurden übermittelt und warten jetzt auf die Freigabe durch einen Administrator. Sobald dein Account aktiviert wurde, erhältst du eine weitere E-Mail.`;
  const html = buildEmailHtml({
    preheader: "Deine Registrierung ist bei uns eingegangen.",
    title: "Registrierung erhalten",
    intro: "Vielen Dank für deine Registrierung. Deine Angaben wurden erfolgreich übermittelt.",
    sections: [
      { label: "Benutzername", value: username },
      { label: "Status", value: "Wartet auf Freigabe" },
    ],
    footerNote: "Sobald dein Account aktiviert wurde, erhältst du eine weitere E-Mail.",
  });

  return sendSmtpMail({ to, subject: "[Milodo] Registrierung erhalten", text, html });
}

export async function sendMemberRegistrationWelcomeEmail({
  to,
  username,
  loginUrl,
}: {
  to: string;
  username: string;
  loginUrl: string;
}) {
  const text = `Hallo!

willkommen bei Milodo. Deine Registrierung wurde erfolgreich abgeschlossen und dein Account ist direkt aktiv.

Dein Benutzername: ${username}

Anmelden: ${loginUrl}

Verwende zur Anmeldung das Passwort, das du bei der Registrierung vergeben hast.`;
  const html = buildEmailHtml({
    preheader: "Dein Milodo Account ist jetzt aktiv.",
    title: "Willkommen bei Milodo",
    intro: "Deine Registrierung wurde erfolgreich abgeschlossen. Dein Account ist jetzt aktiv.",
    sections: [{ label: "Benutzername", value: username }],
    button: { label: "Jetzt anmelden", url: loginUrl },
    footerNote: "Verwende zur Anmeldung das Passwort, das du bei der Registrierung vergeben hast.",
  });

  return sendSmtpMail({ to, subject: "[Milodo] Willkommen – Registrierung bestätigt", text, html });
}

export async function sendMemberRegistrationApprovedEmail({
  to,
  username,
  loginUrl,
}: {
  to: string;
  username: string;
  loginUrl?: string;
}) {
  const loginLine = loginUrl ? `\n\nAnmelden: ${loginUrl}` : "";
  const text = `Hallo!\n\nDein Milodo Account wurde bestätigt und ist jetzt aktiv.\n\nBenutzername: ${username}${loginLine}\n\nDu kannst dich mit dem Passwort anmelden, das du bei der Registrierung vergeben hast.`;
  const html = buildEmailHtml({
    preheader: "Dein Milodo Account wurde bestätigt.",
    title: "Registrierung bestätigt",
    intro: "Dein Account wurde freigegeben und ist jetzt aktiv.",
    sections: [{ label: "Benutzername", value: username }],
    button: loginUrl ? { label: "Jetzt anmelden", url: loginUrl } : undefined,
    footerNote: "Du kannst dich mit dem Passwort anmelden, das du bei der Registrierung vergeben hast.",
  });

  return sendSmtpMail({ to, subject: "[Milodo] Registrierung bestätigt", text, html });
}
