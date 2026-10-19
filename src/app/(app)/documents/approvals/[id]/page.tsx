import { dateFormatter } from "@/lib/date-format";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../../_components/app-shell";
import { Card } from "../../../_components/ui";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { ApprovalActions } from "./_components/approval-actions";

export default async function DocumentExpiryApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") notFound();
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) notFound();
  const document = await db.query.documents.findFirst({ where: (table, { eq }) => eq(table.id, documentId) });
  if (!document || document.expiryApprovalStatus !== "PENDING" || !document.requestedExpiresAt) notFound();
  const owner = await db.query.users.findFirst({ where: (table, { eq }) => eq(table.id, document.ownerId) });
  if (!owner) notFound();
  const date = dateFormatter({ dateStyle: "long", timeZone: "UTC" }).format(document.requestedExpiresAt);

  return <AppShell title="Ablaufdatum genehmigen" subtitle={`Antrag für ${owner.username}`}>
    <Card title={document.title} description={`${document.fileName} · Beantragtes Ablaufdatum: ${date}`} actions={<Link href="/documents#pending-approvals" className="text-sm font-semibold text-[color:var(--accent)]">Zurück zur Übersicht</Link>}>
      <div className="space-y-4">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] sm:aspect-video">
          <iframe title={`Dokument ${document.title}`} src={`/api/documents/${document.id}/download?inline=1`} className="h-full w-full" />
        </div>
        <a href={`/api/documents/${document.id}/download`} className="inline-flex rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold">Dokument separat öffnen / herunterladen</a>
        <p className="text-sm text-[color:var(--muted)]">Mit der Genehmigung wird dieses Datum als Ablaufdatum des Dokuments übernommen.</p>
        <ApprovalActions documentId={document.id} />
      </div>
    </Card>
  </AppShell>;
}
