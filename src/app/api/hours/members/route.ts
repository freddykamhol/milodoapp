import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { timesheetMonths, users } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function parseIntParam(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const now = new Date();
  const year = parseIntParam(url.searchParams.get("year"), now.getFullYear());
  const month = parseIntParam(url.searchParams.get("month"), now.getMonth() + 1);
  if (month < 1 || month > 12) return NextResponse.json({ ok: false, error: "invalid_month" }, { status: 400 });

  const members = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(inArray(users.role, ["ADMIN", "VERWALTUNG", "PERSONAL"]))
    .orderBy(users.username);

  const memberIds = members.map((m) => m.id);

  const currentMonthRows = memberIds.length
    ? await db
        .select({ userId: timesheetMonths.userId, status: timesheetMonths.status })
        .from(timesheetMonths)
        .where(and(eq(timesheetMonths.year, year), eq(timesheetMonths.month, month), inArray(timesheetMonths.userId, memberIds)))
    : [];

  const lastClosedRows = memberIds.length
    ? await db
        .select({
          userId: timesheetMonths.userId,
          maxYm: sql<number>`max(${timesheetMonths.year} * 100 + ${timesheetMonths.month})`.as("maxYm"),
        })
        .from(timesheetMonths)
        .where(and(inArray(timesheetMonths.userId, memberIds), eq(timesheetMonths.status, "CLOSED")))
        .groupBy(timesheetMonths.userId)
    : [];

  const currentMonthByUser = new Map(currentMonthRows.map((r) => [r.userId, r.status] as const));
  const lastClosedByUser = new Map(lastClosedRows.map((r) => [r.userId, r.maxYm] as const));

  const result = members.map((m) => {
    const status = currentMonthByUser.get(m.id) ?? "OPEN";
    const isClosed = status === "CLOSED";

    const maxYm = lastClosedByUser.get(m.id) ?? null;
    const label =
      typeof maxYm === "number" && Number.isFinite(maxYm)
        ? `${String(maxYm % 100).padStart(2, "0")}/${String(Math.floor(maxYm / 100) % 100).padStart(2, "0")}`
        : "—";

    return { ...m, isClosedCurrentMonth: isClosed, lastClosedLabel: label };
  });

  return NextResponse.json({ members: result });
}
