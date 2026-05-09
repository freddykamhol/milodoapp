import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { hourEntries } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isFinite(entryId)) return NextResponse.json({ ok: false }, { status: 400 });

  const entry = await db.query.hourEntries.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, entryId), eq(t.userId, viewer.id)),
  });

  if (!entry) return NextResponse.json({ ok: false }, { status: 404 });

  // check month closed
  const y = entry.actualStartAt.getFullYear();
  const m = entry.actualStartAt.getMonth() + 1;
  const monthRow = await db.query.timesheetMonths.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, viewer.id), eq(t.year, y), eq(t.month, m)),
  });
  if (monthRow?.status === "CLOSED") {
    return NextResponse.json({ ok: false, error: "closed" }, { status: 409 });
  }

  const body = (await request.json()) as { actualStartAt?: string; actualEndAt?: string };
  const newStart = body.actualStartAt ? new Date(body.actualStartAt) : null;
  const newEnd = body.actualEndAt ? new Date(body.actualEndAt) : null;
  if (!newStart || !newEnd || Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid_dates" }, { status: 400 });
  }
  if (newEnd <= newStart) {
    return NextResponse.json({ ok: false, error: "end_before_start" }, { status: 400 });
  }

  await db
    .update(hourEntries)
    .set({ actualStartAt: newStart, actualEndAt: newEnd, updatedAt: new Date() })
    .where(and(eq(hourEntries.id, entryId), eq(hourEntries.userId, viewer.id)));

  return NextResponse.json({ ok: true });
}
