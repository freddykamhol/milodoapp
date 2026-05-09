import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogAssets, blogMedia, blogPosts } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { storeBlogAsset } from "@/lib/blog-storage";
import { ensureBlogSchema } from "@/lib/blog-schema";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensureBlogSchema();
  const form = await request.formData();
  const postId = Number(form.get("postId"));
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  if (!Number.isFinite(postId)) return NextResponse.json({ ok: false, error: "invalid_post" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  if (kind !== "TITLE" && kind !== "INLINE") return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });

  const post = await db.query.blogPosts.findFirst({ where: (t, { eq }) => eq(t.id, postId) });
  if (!post) return NextResponse.json({ ok: false, error: "post_not_found" }, { status: 404 });

  const stored = await storeBlogAsset({ file });

  // insert into global media library (dedupe by unique storageKey)
  await db
    .insert(blogMedia)
    .values({
      fileName: stored.storedName,
      mimeType: stored.mimeType,
      storageKey: stored.storageKey,
      sizeBytes: stored.sizeBytes,
    })
    .onConflictDoNothing();

  const inserted = await db
    .insert(blogAssets)
    .values({
      postId: post.id,
      kind: kind as any,
      fileName: stored.storedName,
      mimeType: stored.mimeType,
      storageKey: stored.storageKey,
      sizeBytes: stored.sizeBytes,
    })
    .returning({ id: blogAssets.id });

  if (kind === "TITLE") {
    await db
      .update(blogPosts)
      .set({ titleImageKey: stored.storageKey, updatedAt: new Date() })
      .where(eq(blogPosts.id, post.id));
  }

  return NextResponse.json({
    ok: true,
    id: inserted.at(0)?.id ?? null,
    storageKey: stored.storageKey,
    url: `/api/blog/assets/raw?key=${encodeURIComponent(stored.storageKey)}`,
  });
}
