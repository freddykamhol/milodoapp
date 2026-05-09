import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogMedia, blogPosts } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { ensureBlogSchema } from "@/lib/blog-schema";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensureBlogSchema();
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Partial<{ storageKey: string }>;
  const storageKey = String(body.storageKey || "").trim();

  const post = await db.query.blogPosts.findFirst({ where: (t, { eq }) => eq(t.id, postId) });
  if (!post) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (storageKey) {
    const media = await db.query.blogMedia.findFirst({ where: (t, { eq }) => eq(t.storageKey, storageKey) });
    if (!media) return NextResponse.json({ ok: false, error: "media_not_found" }, { status: 404 });
  }

  await db
    .update(blogPosts)
    .set({ titleImageKey: storageKey, updatedAt: new Date() })
    .where(eq(blogPosts.id, postId));

  return NextResponse.json({
    ok: true,
    storageKey,
    url: storageKey ? `/api/blog/assets/raw?key=${encodeURIComponent(storageKey)}` : "",
  });
}

