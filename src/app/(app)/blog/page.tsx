import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc } from "drizzle-orm";

import { AppShell } from "../_components/app-shell";
import { Card } from "../_components/ui";
import { db } from "@/lib/db";
import { blogPosts } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { ensureBlogSchema } from "@/lib/blog-schema";
import { BlogAdminListClient, type BlogAdminRow } from "./_components/blog-admin-list-client";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
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

  const clientRows: BlogAdminRow[] = rows.map((r) => ({
    id: r.id,
    title: String(r.title ?? ""),
    category: String(r.category ?? ""),
    slug: String(r.slug ?? ""),
    status: (String(r.status || "DRAFT") as BlogAdminRow["status"]) || "DRAFT",
    updatedAtIso: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
  }));

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
        <BlogAdminListClient initialRows={clientRows} />
      </Card>
    </AppShell>
  );
}
