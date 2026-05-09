import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentSectionMembers } from "@/db/schema";
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

  const body = (await request.json().catch(() => null)) as
    | { sectionId?: unknown; userId?: unknown }
    | null;
  const sectionId = Number(body?.sectionId);
  const userId = Number(body?.userId);
  if (!Number.isFinite(sectionId) || !Number.isFinite(userId)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const section = await db.query.appointmentSections.findFirst({ where: (t, { eq }) => eq(t.id, sectionId) });
  if (!section || section.appointmentId !== appointmentId) {
    return NextResponse.json({ ok: false, error: "invalid_section" }, { status: 404 });
  }

  await db
    .delete(appointmentSectionMembers)
    .where(and(eq(appointmentSectionMembers.sectionId, sectionId), eq(appointmentSectionMembers.userId, userId)));

  return NextResponse.json({ ok: true });
}
