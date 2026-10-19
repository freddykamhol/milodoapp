import { dateFormatter } from "@/lib/date-format";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../_components/app-shell";
import { Badge, Card } from "../_components/ui";
import { db } from "@/lib/db";
import { documents, users } from "@/db/schema";
import { and, count, eq, isNotNull, like } from "drizzle-orm";
import { getViewer } from "@/lib/viewer";

export default async function DocumentsIndexPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await getViewer();
  if (!user) redirect("/login");

  const isAdminOrVerwaltung = user.role === "ADMIN" || user.role === "VERWALTUNG";

  if (user.role === "KUNDE") {
    redirect("/documents/services");
  }

  if (!isAdminOrVerwaltung) {
    redirect(`/documents/${user.id}`);
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 200);
  const filter = query ? like(users.username, `%${query}%`) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(users).where(filter);
  const pages = Math.max(1, Math.ceil(total / 50));
  const requestedPage = Number(params.page);
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  const pageUrl = (target: number) => `/documents?${new URLSearchParams({ q: query, page: String(target) })}`;
  const members = await db.query.users.findMany({
    columns: { id: true, username: true, role: true, qualRD: true, qualAusb: true },
    where: filter,
    limit: 50,
    offset: (page - 1) * 50,
    orderBy: (t, { asc }) => [asc(t.role), asc(t.username)],
  });
  const pendingApprovals = await db.select({ document: documents, username: users.username })
    .from(documents)
    .innerJoin(users, eq(documents.ownerId, users.id))
    .where(and(eq(documents.expiryApprovalStatus, "PENDING"), isNotNull(documents.requestedExpiresAt)))
    .orderBy(documents.createdAt);

  return (
    <AppShell title="Dokumente" subtitle="Mitglieder auswählen und Dokumente verwalten.">
      <div id="pending-approvals"><Card title="Genehmigungen ausstehend" description={pendingApprovals.length ? `${pendingApprovals.length} manuelle Ablaufdaten warten auf Freigabe.` : "Aktuell keine offenen Ablaufdatum-Anträge."}>
        {pendingApprovals.length ? <ul className="space-y-2">{pendingApprovals.map(({ document, username }) => <li key={document.id} className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold">{document.title}</p><p className="mt-1 text-xs text-[color:var(--muted)]">{username} · {document.fileName} · beantragt bis {document.requestedExpiresAt ? dateFormatter({ dateStyle: "medium", timeZone: "UTC" }).format(document.requestedExpiresAt) : "—"}</p></div><Link href={`/documents/approvals/${document.id}`} className="shrink-0 rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-center text-sm font-semibold text-white">Dokument prüfen</Link></li>)}</ul> : null}
      </Card></div>
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
          <Badge tone="accent">Fahrerlaubnisse</Badge>
          <Badge tone="accent">Qualifikationen</Badge>
          <Badge tone="accent">Arbeitsverträge</Badge>
        </div>
      </Card>

      <Card title="Mitglieder" description="Klicke ein Mitglied an, um dessen Dokumente zu öffnen.">
        <form className="mb-4 flex flex-wrap gap-2" action="/documents">
          <input name="q" defaultValue={query} aria-label="Mitglieder suchen" placeholder="Mitglieder suchen …" maxLength={200} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
          <button className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Suchen</button>
        </form>
        <p className="mb-3 text-xs text-[color:var(--muted)]">{total} Mitglieder · Seite {page} von {pages}</p>
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
        {pages > 1 ? <nav aria-label="Mitgliederseiten" className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
          {page > 1 ? <Link href={pageUrl(page - 1)} className="rounded-xl border border-[var(--border)] px-4 py-2">Zurück</Link> : <span />}
          {page < pages ? <Link href={pageUrl(page + 1)} className="rounded-xl border border-[var(--border)] px-4 py-2">Weiter</Link> : null}
        </nav> : null}
      </Card>
    </AppShell>
  );
}
