import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { timesheetMonths } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const body = (await request.json()) as { year?: number; month?: number };
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  await db
    .insert(timesheetMonths)
    .values({ userId: viewer.id, year, month })
    .onConflictDoNothing();

  const row = await db.query.timesheetMonths.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, viewer.id), eq(t.year, year), eq(t.month, month)),
  });

  if (row?.status === "CLOSED") {
    return NextResponse.json({ ok: true });
  }

  await db
    .update(timesheetMonths)
    .set({ status: "CLOSED", closedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(timesheetMonths.userId, viewer.id), eq(timesheetMonths.year, year), eq(timesheetMonths.month, month)));

  return NextResponse.json({ ok: true });
}
