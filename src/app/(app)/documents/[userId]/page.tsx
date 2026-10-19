import { dateFormatter } from "@/lib/date-format";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { AppShell } from "../../_components/app-shell";
import { Badge, Card } from "../../_components/ui";
import { db } from "@/lib/db";
import { documentExpiryPreferences, documentExpirySettings, documents, users } from "@/db/schema";
import { DocumentUploader } from "./_components/document-uploader";
import { DocumentFile } from "./_components/document-file";
import { getViewer } from "@/lib/viewer";
import { backfillDocumentExpiryDates } from "@/lib/document-expiry";

type UserRow = typeof users.$inferSelect;
type DocumentRow = typeof documents.$inferSelect;

function classify(doc: DocumentRow) {
  if (doc.category === "CV") return "cv";
  if (doc.category === "TRAINING") return "training";
  if (doc.category === "DRIVER_LICENSE") return "driver_license";
  if (doc.category === "QUALIFICATION") return "qualification";
  if (doc.category === "CONTRACT") return "contract";
  const t = `${doc.title} ${doc.fileName}`.toLowerCase();
  if (t.includes("lebenslauf") || t.includes("cv")) return "cv";
  if (t.includes("fortbildung") || t.includes("ausbildung") || t.includes("nachweis")) return "training";
  if (t.includes("fahrerlaubnis") || t.includes("führerschein") || t.includes("fuehrerschein")) return "driver_license";
  if (t.includes("qualifikation")) return "qualification";
  if (t.includes("vertrag") || t.includes("arbeitsvertrag")) return "contract";
  return "other";
}

function formatDate(date: Date) {
  return dateFormatter({ day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function expiryCategory(doc: DocumentRow) {
  if (doc.category === "TRAINING" || doc.category === "DRIVER_LICENSE" || doc.category === "QUALIFICATION") return doc.category;
  const kind = classify(doc);
  if (kind === "training") return "TRAINING";
  if (kind === "driver_license") return "DRIVER_LICENSE";
  if (kind === "qualification") return "QUALIFICATION";
  return null;
}

function ExpiryStatus({ doc, reminderDays }: { doc: DocumentRow; reminderDays: number }) {
  if (doc.expiryApprovalStatus === "PENDING" && doc.requestedExpiresAt) return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">Genehmigung ausstehend · beantragt bis {formatDate(doc.requestedExpiresAt)}</span>;
  if (!doc.expiresAt) return null;
  const now = new Date();
  const expired = doc.expiresAt.getTime() < now.getTime();
  const upcoming = !expired && reminderDays > 0 && doc.expiresAt.getTime() <= now.getTime() + reminderDays * 86400000;
  const style = expired ? "border-red-200 bg-red-50 text-red-800" : upcoming ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[var(--border)] bg-[var(--surface-2)] text-[color:var(--muted)]";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${style}`}>
    {expired || upcoming ? <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full bg-current/10 text-[10px] font-black">!</span> : null}
    {expired ? "Abgelaufen" : upcoming ? "Läuft bald ab" : "Gültig bis"} {formatDate(doc.expiresAt)}
  </span>;
}

function Section({
  title,
  docs,
  canUpload,
  category,
  reminderDaysByCategory,
}: {
  title: string;
  docs: DocumentRow[];
  canUpload: boolean;
  category: "CV" | "TRAINING" | "DRIVER_LICENSE" | "QUALIFICATION" | "CONTRACT" | null;
  reminderDaysByCategory: Record<string, number>;
}) {
  return (
    <Card title={title} description={docs.length ? `${docs.length} Dokument(e)` : "Noch keine Dokumente."}>
      {docs.length ? (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{d.title}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                  {d.fileName} • {formatDate(d.createdAt)}
                </p>
                {d.expiresAt || d.requestedExpiresAt ? <div className="mt-2"><ExpiryStatus doc={d} reminderDays={reminderDaysByCategory[expiryCategory(d) ?? ""] ?? 0} /></div> : null}
              </div>
              <div className="min-w-0 sm:w-1/2"><DocumentFile id={d.id} name={d.fileName} mimeType={d.mimeType??'application/octet-stream'} canDelete={canUpload}/></div>
            </li>
          ))}
        </ul>
      ) : (
        canUpload && category ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6 text-center">
            <p className="text-sm font-semibold">Noch leer</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">Dokumente können oben über das Upload-Formular hinzugefügt werden.</p>
          </div>
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

  await backfillDocumentExpiryDates();
  await db.insert(documentExpiryPreferences).values({ id: 1 }).onConflictDoNothing();
  const expiryPreferences = await db.query.documentExpiryPreferences.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  const expirySettings = await db.select().from(documentExpirySettings);
  const reminderDaysByCategory = Object.fromEntries(expirySettings.map((setting) => [setting.category, setting.reminderDaysBefore])) as Record<string, number>;

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
  const driverLicenses = docsOnSftp.filter((d) => classify(d) === "driver_license");
  const qualifications = docsOnSftp.filter((d) => classify(d) === "qualification");
  const contract = docsOnSftp.filter((d) => classify(d) === "contract");

  return (
    <AppShell title="Dokumente" subtitle={`Mitglied: ${target.username}`}>
      <DocumentUploader ownerId={target.id} canUpload={canUpload} manualExpiryRequiresApproval={expiryPreferences?.manualExpiryRequiresApproval ?? false} />

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
        <Section title="Lebenslauf" docs={cv} canUpload={canUpload} category="CV" reminderDaysByCategory={reminderDaysByCategory} />
        <Section
          title="Aus- und Fortbildungsnachweise"
          docs={training}
          canUpload={canUpload}
          category="TRAINING"
          reminderDaysByCategory={reminderDaysByCategory}
        />
        <Section title="Fahrerlaubnisse" docs={driverLicenses} canUpload={canUpload} category="DRIVER_LICENSE" reminderDaysByCategory={reminderDaysByCategory} />
        <Section title="Qualifikationen" docs={qualifications} canUpload={canUpload} category="QUALIFICATION" reminderDaysByCategory={reminderDaysByCategory} />
        <Section title="Arbeitsverträge" docs={contract} canUpload={canUpload} category="CONTRACT" reminderDaysByCategory={reminderDaysByCategory} />
      </section>

      <Section title="Alle Dokumente" docs={docsOnSftp} canUpload={canUpload} category={null} reminderDaysByCategory={reminderDaysByCategory} />
    </AppShell>
  );
}
