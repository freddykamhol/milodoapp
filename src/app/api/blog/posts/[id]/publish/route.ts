import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { writeBlogExport } from "@/lib/blog-storage";
import { ensureBlogSchema } from "@/lib/blog-schema";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensureBlogSchema();
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const row = await db.query.blogPosts.findFirst({ where: (t, { eq }) => eq(t.id, postId) });
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const publishedAt = row.publishedAt ?? new Date();

  await writeBlogExport({
    category: row.category,
    postId: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentMd: row.contentMd,
    titleImageKey: row.titleImageKey,
    publishedAt,
  });

  await db
    .update(blogPosts)
    .set({ status: "PUBLISHED", publishedAt, updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id));

  return NextResponse.json({ ok: true });
}
