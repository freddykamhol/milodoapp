import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc } from "drizzle-orm";

import { AppShell } from "../_components/app-shell";
import { Badge, Card, type BadgeTone } from "../_components/ui";
import { db } from "@/lib/db";
import { blogPosts } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { ensureBlogSchema } from "@/lib/blog-schema";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

function statusTone(status: string): BadgeTone {
  if (status === "PUBLISHED") return "success";
  if (status === "ARCHIVED") return "danger";
  return "muted";
}

export default async function BlogAdminPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!isAdminOrVerwaltung(viewer.role)) notFound();

  await ensureBlogSchema();
  let rows: Array<typeof blogPosts.$inferSelect> = [];
  try {
    rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.updatedAt)).limit(300);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (!msg.includes("no such table")) throw e;
  }

  return (
    <AppShell title="Blog" subtitle="Blog-Beiträge erstellen, bearbeiten und veröffentlichen.">
      <Card
        title="Beiträge"
        description={`${rows.length} Einträge (max. 300 zuletzt).`}
        actions={
          <Link
            href="/blog/new"
            className="inline-flex items-center justify-center rounded-xl bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:brightness-[1.02]"
          >
            Neuer Beitrag
          </Link>
        }
      >
        <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {rows.length ? (
            rows.map((r) => (
              <Link
                key={r.id}
                href={`/blog/${r.id}`}
                className="flex flex-col gap-2 px-4 py-3 transition hover:bg-[var(--surface-2)] md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">{r.title || "(ohne Titel)"}</p>
                  <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                    {r.category} · {r.slug || "—"} ·{" "}
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleString("de-DE") : "—"}
                  </p>
                </div>
                <div className="shrink-0">
                  <Badge tone={statusTone(String(r.status || ""))}>{String(r.status || "")}</Badge>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-[color:var(--muted)]">Noch keine Blog-Beiträge vorhanden.</div>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
