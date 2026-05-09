import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTimesheetIndex } from "@/lib/timesheets";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function parseIntParam(value: string | null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const userId = parseIntParam(url.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ ok: false, error: "missing_userId" }, { status: 400 });

  const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  if (!target) return NextResponse.json({ ok: false, error: "unknown_user" }, { status: 404 });

  const data = await getTimesheetIndex({ userId, now: new Date() });
  return NextResponse.json({ ok: true, ...data });
}
