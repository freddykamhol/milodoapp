import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications } from "@/db/schema";
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
    | { userId?: unknown; role?: unknown }
    | null;
  const userId = Number(body?.userId);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 });
  const role = body?.role === "EL" ? "EL" : "NORMAL";

  await db
    .update(appointmentApplications)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(appointmentApplications.appointmentId, appointmentId), eq(appointmentApplications.userId, userId)));

  return NextResponse.json({ ok: true });
}
