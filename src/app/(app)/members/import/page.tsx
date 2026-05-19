import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "../../_components/app-shell";
import { Card } from "../../_components/ui";
import { getViewer } from "@/lib/viewer";

import { MembersImportClient } from "./_components/members-import-client";

export default async function MembersImportPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "ADMIN") redirect("/members");

  return (
    <AppShell title="Mitglieder importieren" subtitle="CSV Import mit automatischem Username/Passwort und E-Mail Versand.">
      <div className="mx-auto w-full max-w-3xl">
        <Card
          title="CSV Import"
          description="Lade eine CSV hoch. Für jede Zeile wird ein Benutzer angelegt, Username/Passwort werden generiert und per Mail verschickt."
          actions={
            <Link href="/members" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
              Zurück
            </Link>
          }
        >
          <MembersImportClient />
        </Card>
      </div>
    </AppShell>
  );
}

