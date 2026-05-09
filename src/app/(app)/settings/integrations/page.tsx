import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { decryptSecret } from "@/lib/secrets";

import { IntegrationsClient } from "./_components/integrations-client";

export default async function IntegrationsSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "KUNDE") notFound();

  const isAdmin = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const isAdminOnly = viewer.role === "ADMIN";

  const [smtpRow, sftpRow, telegramRow, telegramChats, telegramJoinLinks, prowlKeys] = await Promise.all([
    isAdmin ? db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) }) : Promise.resolve(null),
    isAdminOnly ? db.query.sftpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) }) : Promise.resolve(null),
    isAdmin ? db.query.telegramSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) }) : Promise.resolve(null),
    isAdmin ? db.query.telegramChats.findMany({ orderBy: (t, { asc }) => [asc(t.name), asc(t.id)] }) : Promise.resolve([]),
    !isAdmin
      ? db.query.telegramChats.findMany({
          where: (t, { and, eq, ne }) => and(eq(t.enabled, true), ne(t.inviteUrl, "")),
          orderBy: (t, { asc }) => [asc(t.name), asc(t.id)],
        })
      : Promise.resolve([]),
    db.query.prowlKeys.findMany({ where: (t, { eq }) => eq(t.userId, viewer.id), orderBy: (t, { asc }) => [asc(t.label), asc(t.id)] }),
  ]);

  return (
    <IntegrationsClient
      viewer={{ role: viewer.role }}
      initialSmtp={
        isAdmin
          ? {
              enabled: smtpRow?.enabled ?? false,
              host: smtpRow?.host ?? "",
              port: smtpRow?.port ?? 587,
              username: smtpRow?.username ?? "",
              password: decryptSecret(smtpRow?.password ?? ""),
              fromEmail: smtpRow?.fromEmail ?? "",
              secure: smtpRow?.secure ?? false,
            }
          : null
      }
      initialTelegram={
        isAdmin
          ? {
              botToken: telegramRow?.botToken ?? "",
              chats: telegramChats.map((c) => ({
                id: c.id,
                enabled: c.enabled,
                name: c.name,
                chatId: c.chatId,
                inviteUrl: c.inviteUrl,
                kindsJson: c.kindsJson,
              })),
            }
          : null
      }
      initialSftp={
        isAdminOnly
          ? {
              enabled: sftpRow?.enabled ?? false,
              host: sftpRow?.host ?? "",
              port: sftpRow?.port ?? 22,
              username: sftpRow?.username ?? "",
              password: decryptSecret(sftpRow?.password ?? ""),
              remotePath: sftpRow?.remotePath ?? "/",
            }
          : null
      }
      telegramJoinLinks={
        !isAdmin
          ? telegramJoinLinks.map((c) => ({ name: c.name, inviteUrl: c.inviteUrl }))
          : []
      }
      initialProwlKeys={prowlKeys.map((k) => ({ id: k.id, enabled: k.enabled, label: k.label, apiKey: k.apiKey }))}
    />
  );
}
