import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { AppShell } from "../../_components/app-shell";
import { Badge, Card } from "../../_components/ui";
import { db } from "@/lib/db";
import { documents, users } from "@/db/schema";
import { DocumentUploader } from "./_components/document-uploader";
import { DocumentDropzone } from "./_components/document-dropzone";
import { getViewer } from "@/lib/viewer";

type UserRow = typeof users.$inferSelect;
type DocumentRow = typeof documents.$inferSelect;

function classify(doc: DocumentRow) {
  if (doc.category === "CV") return "cv";
  if (doc.category === "TRAINING") return "training";
  if (doc.category === "CONTRACT") return "contract";
  const t = `${doc.title} ${doc.fileName}`.toLowerCase();
  if (t.includes("lebenslauf") || t.includes("cv")) return "cv";
  if (t.includes("fortbildung") || t.includes("ausbildung") || t.includes("nachweis")) return "training";
  if (t.includes("vertrag") || t.includes("arbeitsvertrag")) return "contract";
  return "other";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function Section({
  title,
  docs,
  ownerId,
  canUpload,
  category,
}: {
  title: string;
  docs: DocumentRow[];
  ownerId: number;
  canUpload: boolean;
  category: "CV" | "TRAINING" | "CONTRACT" | null;
}) {
  return (
    <Card title={title} description={docs.length ? `${docs.length} Dokument(e)` : "Noch keine Dokumente."}>
      {docs.length ? (
        <ul className="space-y-2">
          {docs.slice(0, 8).map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{d.title}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                  {d.fileName} • {formatDate(d.createdAt)}
                </p>
              </div>
              <Link
                href={`/api/documents/${d.id}/download`}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Download
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        canUpload && category ? (
          <DocumentDropzone
            ownerId={ownerId}
            category={category}
            label="Noch leer"
            description="Zieh ein Dokument hierher oder klicke zum Hochladen."
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6 text-center">
            <p className="text-sm font-semibold">Noch leer</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">Für Upload benötigst du Berechtigung.</p>
          </div>
        )
      )}
    </Card>
  );
}

export default async function DocumentsUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const targetId = Number(userId);
  if (!Number.isFinite(targetId)) notFound();

  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, targetId) });
  if (!target) notFound();

  const isAdminOrVerwaltung = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const canView = isAdminOrVerwaltung || viewer.id === target.id;
  if (!canView) notFound();
  const canUpload = isAdminOrVerwaltung || viewer.id === target.id;

  // SFTP checks (exists/mkdir) are intentionally not done here to keep page loads fast.
  // Download/Upload endpoints handle availability errors.

  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.ownerId, target.id))
    .orderBy(desc(documents.createdAt));

  const docsOnSftp = docs;

  const cv = docsOnSftp.filter((d) => classify(d) === "cv");
  const training = docsOnSftp.filter((d) => classify(d) === "training");
  const contract = docsOnSftp.filter((d) => classify(d) === "contract");

  return (
    <AppShell title="Dokumente" subtitle={`Mitglied: ${target.username}`}>
      <DocumentUploader ownerId={target.id} canUpload={canUpload} />

      <Card
        title="Übersicht"
        description="Dokumente sind nur für das jeweilige Mitglied und Admin/Verwaltung sichtbar."
        actions={
          isAdminOrVerwaltung ? (
            <Link
              href="/documents"
              className="text-xs font-semibold text-[color:var(--accent)] hover:underline"
            >
              Zurück
            </Link>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="muted">{target.role}</Badge>
          {target.qualRD ? <Badge tone="accent">Qualifikation RD: {target.qualRD}</Badge> : null}
          {target.qualAusb ? (
            <Badge tone="accent">Qualifikation Ausbildung: {target.qualAusb}</Badge>
          ) : null}
          <Badge tone="muted">{docsOnSftp.length} Dokument(e)</Badge>
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title="Lebenslauf" docs={cv} ownerId={target.id} canUpload={canUpload} category="CV" />
        <Section
          title="Aus- und Fortbildungsnachweise"
          docs={training}
          ownerId={target.id}
          canUpload={canUpload}
          category="TRAINING"
        />
        <Section title="Arbeitsverträge" docs={contract} ownerId={target.id} canUpload={canUpload} category="CONTRACT" />
      </section>

      <Section title="Alle Dokumente" docs={docsOnSftp} ownerId={target.id} canUpload={canUpload} category={null} />
    </AppShell>
  );
}
