import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensureBlogSchema();
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const row = await db.query.blogPosts.findFirst({ where: (t, { eq }) => eq(t.id, postId), with: { assets: true } });
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, row });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensureBlogSchema();
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Partial<{
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    title: string;
    category: string;
    slug: string;
    excerpt: string;
    contentMd: string;
    contentBlocksJson: string;
    titleImageKey: string;
  }>;

  const updates: Partial<typeof blogPosts.$inferInsert> = { updatedAt: new Date() };

  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.excerpt === "string") updates.excerpt = body.excerpt.trim();
  if (typeof body.contentMd === "string") updates.contentMd = body.contentMd;
  if (typeof body.contentBlocksJson === "string") updates.contentBlocksJson = body.contentBlocksJson;
  if (typeof body.titleImageKey === "string") updates.titleImageKey = body.titleImageKey;
  if (typeof body.category === "string") updates.category = blogCategoryKey(body.category);
  if (typeof body.slug === "string") updates.slug = slugify(body.slug) || slugify(updates.title || "") || "";
  if (body.status === "DRAFT" || body.status === "PUBLISHED" || body.status === "ARCHIVED") updates.status = body.status;

  await db.update(blogPosts).set(updates).where(eq(blogPosts.id, postId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  await db.delete(blogPosts).where(eq(blogPosts.id, postId));
  return NextResponse.json({ ok: true });
}
