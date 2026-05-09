import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { blogCategoryKey } from "@/lib/blog-storage";
import { ensureBlogSchema } from "@/lib/blog-schema";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll(/[^a-z0-9\s-]/g, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-")
    .slice(0, 80);
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensureBlogSchema();
  const rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.updatedAt)).limit(300);
  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensureBlogSchema();
  const body = (await request.json().catch(() => ({}))) as Partial<{
    title: string;
    category: string;
  }>;

  const title = String(body.title ?? "").trim();
  const category = blogCategoryKey(String(body.category ?? "allgemein"));
  if (!title) return NextResponse.json({ ok: false, error: "invalid_title" }, { status: 400 });

  const baseSlug = slugify(title) || "beitrag";
  let slug = baseSlug;
  for (let n = 0; n < 50; n += 1) {
    const exists = await db.query.blogPosts.findFirst({
      where: (t, { eq, and }) => and(eq(t.category, category), eq(t.slug, slug)),
      columns: { id: true },
    });
    if (!exists) break;
    slug = `${baseSlug}-${n + 2}`;
  }

  const inserted = await db
    .insert(blogPosts)
    .values({
      status: "DRAFT",
      title,
      category,
      slug,
    })
    .returning({ id: blogPosts.id });

  return NextResponse.json({ ok: true, id: inserted.at(0)?.id ?? null });
}
