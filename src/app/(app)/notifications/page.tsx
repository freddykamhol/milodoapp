import { AppShell } from "../_components/app-shell";
import { NotificationsPageClient } from "./_components/notifications-page-client";

import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <AppShell title="Benachrichtigungen" subtitle="Ungelesene generell + alle der letzten 7 Tage.">
      <NotificationsPageClient />
    </AppShell>
  );
}
