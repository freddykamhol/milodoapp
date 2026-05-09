import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getHoursMonthData } from "@/lib/hours";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function parseIntParam(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseOptionalIntParam(value: string | null) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const url = new URL(request.url);
  const now = new Date();
  const year = parseIntParam(url.searchParams.get("year"), now.getFullYear());
  const month = parseIntParam(url.searchParams.get("month"), now.getMonth() + 1);
  const requestedUserId = parseOptionalIntParam(url.searchParams.get("userId"));
  const forUserId =
    requestedUserId && (viewer.role === "ADMIN" || viewer.role === "VERWALTUNG") ? requestedUserId : viewer.id;

  if (month < 1 || month > 12) {
    return NextResponse.json({ ok: false, error: "invalid_month" }, { status: 400 });
  }

  if (forUserId !== viewer.id) {
    const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, forUserId) });
    if (!target) return NextResponse.json({ ok: false, error: "unknown_user" }, { status: 404 });
  }

  const data = await getHoursMonthData({ userId: forUserId, year, month, now });
  return NextResponse.json(data);
}
