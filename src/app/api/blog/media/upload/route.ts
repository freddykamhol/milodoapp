import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { blogMedia } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { ensureBlogSchema } from "@/lib/blog-schema";
import { storeBlogAsset } from "@/lib/blog-storage";

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
  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if (key !== "file") continue;
    if (value instanceof File) files.push(value);
  }
  if (!files.length) return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ ok: false, error: "too_many" }, { status: 400 });

  const inserted: Array<typeof blogMedia.$inferSelect & { url: string }> = [];

  for (const file of files) {
    const stored = await storeBlogAsset({ file });
    await db
      .insert(blogMedia)
      .values({
        fileName: stored.storedName,
        mimeType: stored.mimeType,
        storageKey: stored.storageKey,
        sizeBytes: stored.sizeBytes,
      })
      .onConflictDoNothing();

    const row = await db.query.blogMedia.findFirst({ where: (t, { eq }) => eq(t.storageKey, stored.storageKey) });
    if (row) inserted.push({ ...(row as any), url: `/api/blog/assets/raw?key=${encodeURIComponent(row.storageKey)}` });
  }

  return NextResponse.json({ ok: true, rows: inserted });
}

