import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogMedia } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { ensureBlogSchema } from "@/lib/blog-schema";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensureBlogSchema();

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "60");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 60;

  const rows = await db.select().from(blogMedia).orderBy(desc(blogMedia.createdAt)).limit(limit);
  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      ...r,
      url: `/api/blog/assets/raw?key=${encodeURIComponent(r.storageKey)}`,
    })),
  });
}

