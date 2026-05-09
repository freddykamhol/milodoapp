import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentSections } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "missing_title" }, { status: 400 });

  const last = await db
    .select({ sortOrder: appointmentSections.sortOrder })
    .from(appointmentSections)
    .where(eq(appointmentSections.appointmentId, appointmentId))
    .orderBy(desc(appointmentSections.sortOrder))
    .limit(1);

  const nextSort = (last.at(0)?.sortOrder ?? 0) + 1;
  const inserted = await db
    .insert(appointmentSections)
    .values({ appointmentId, title, sortOrder: nextSort })
    .returning({ id: appointmentSections.id, title: appointmentSections.title, sortOrder: appointmentSections.sortOrder });

  return NextResponse.json({ ok: true, section: inserted.at(0) ?? null });
}
