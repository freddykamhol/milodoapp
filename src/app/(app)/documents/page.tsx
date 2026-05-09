import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../_components/app-shell";
import { Badge, Card } from "../_components/ui";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export default async function DocumentsIndexPage() {
  const user = await getViewer();
  if (!user) redirect("/login");

  const isAdminOrVerwaltung = user.role === "ADMIN" || user.role === "VERWALTUNG";

  if (user.role === "KUNDE") {
    redirect("/documents/services");
  }

  if (!isAdminOrVerwaltung) {
    redirect(`/documents/${user.id}`);
  }

  const members = await db.query.users.findMany({
    orderBy: (t, { asc }) => [asc(t.role), asc(t.username)],
  });

  return (
    <AppShell title="Dokumente" subtitle="Mitglieder auswählen und Dokumente verwalten.">
      <Card title="Meine Dokumente" description="Schnellzugriff auf deine eigenen Dateien.">
        <Link
          href={`/documents/${user.id}`}
          className="inline-flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:bg-[var(--surface-2)]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.username}</p>
            <p className="mt-1 truncate text-xs text-[color:var(--muted)]">Öffnen und verwalten</p>
          </div>
          <Badge tone="muted">Öffnen</Badge>
        </Link>
      </Card>

      <Card
        title="Bereiche"
        description="Dokumente sind nur für das jeweilige Mitglied und Admin/Verwaltung sichtbar."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Lebenslauf</Badge>
          <Badge tone="accent">Aus- und Fortbildungsnachweise</Badge>
          <Badge tone="accent">Arbeitsverträge</Badge>
        </div>
      </Card>

      <Card title="Mitglieder" description="Klicke ein Mitglied an, um dessen Dokumente zu öffnen.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {members.map((m) => (
            <Link
              key={m.id}
              href={`/documents/${m.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:bg-[var(--surface-2)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{m.username}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                  Rolle: {m.role}
                  {m.qualRD ? ` • Qualifikation RD: ${m.qualRD}` : ""}
                  {m.qualAusb ? ` • Qualifikation Ausbildung: ${m.qualAusb}` : ""}
                </p>
              </div>
              <Badge tone="muted">Öffnen</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
