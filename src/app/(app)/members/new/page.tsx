import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../_components/app-shell";
import { Card } from "../../_components/ui";
import { MemberCreateClient } from "./_components/member-create-client";
import { getViewer } from "@/lib/viewer";

export default async function MemberNewPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const canCreate = viewer.role === "ADMIN";

  return (
    <AppShell title="Mitglied anlegen" subtitle="Neues Mitglied erstellen.">
      <Card
        title={canCreate ? "Neues Mitglied" : "Kein Zugriff"}
        description={
          canCreate
            ? "Username wird automatisch vergeben, Passwort wird per E-Mail im Klartext versendet."
            : "Nur Admin darf Mitglieder anlegen."
        }
        actions={
          <Link
            href="/members"
            className="text-xs font-semibold text-[color:var(--accent)] hover:underline"
          >
            Zurück
          </Link>
        }
      >
        {canCreate ? <MemberCreateClient /> : <p className="text-sm text-[color:var(--muted)]">Du hast keine Berechtigung.</p>}
      </Card>
    </AppShell>
  );
}
