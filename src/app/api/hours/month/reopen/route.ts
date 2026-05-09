import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { notifications, timesheetEvents, timesheetMonths } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: number; year?: number; month?: number; note?: string };
  const userId = Number(body.userId);
  const year = Number(body.year);
  const month = Number(body.month);
  const note = String(body.note ?? "").trim();

  if (!Number.isFinite(userId) || !Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (!note) return NextResponse.json({ ok: false, error: "missing_note" }, { status: 400 });

  const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  if (!target) return NextResponse.json({ ok: false, error: "unknown_user" }, { status: 404 });

  await db
    .insert(timesheetMonths)
    .values({ userId, year, month })
    .onConflictDoNothing();

  await db
    .update(timesheetMonths)
    .set({ status: "OPEN", closedAt: null, updatedAt: new Date() })
    .where(and(eq(timesheetMonths.userId, userId), eq(timesheetMonths.year, year), eq(timesheetMonths.month, month)));

  await db.insert(timesheetEvents).values({ userId, year, month, action: "REOPEN", note, actorUserId: viewer.id });

  const ymLabel = `${String(month).padStart(2, "0")}/${String(year % 100).padStart(2, "0")}`;
  await db.insert(notifications).values({
    scope: "USER",
    userId,
    kind: "TIMESHEET",
    title: "Stundenzettel freigegeben",
    body: `Dein Stundenzettel für ${ymLabel} wurde zur Bearbeitung freigegeben.\n\nBegründung: ${note}`,
    href: `/hours?year=${year}&month=${month}`,
  });

  return NextResponse.json({ ok: true });
}
