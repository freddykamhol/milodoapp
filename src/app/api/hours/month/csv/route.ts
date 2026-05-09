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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function csvEscape(value: string) {
  if (/[";\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
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
  if (month < 1 || month > 12) return NextResponse.json({ ok: false, error: "invalid_month" }, { status: 400 });

  if (forUserId !== viewer.id) {
    const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, forUserId) });
    if (!target) return NextResponse.json({ ok: false, error: "unknown_user" }, { status: 404 });
  }

  const data = await getHoursMonthData({ userId: forUserId, year, month, now });

  const header = [
    "Datum",
    "Start",
    "Ende",
    "DauerMinuten",
    "DauerStunden",
    "Titel",
    "Einsatzort",
    "Kunde",
    "Dienstart",
    "TerminId",
  ];

  const lines = [header.join(";")];

  for (const e of data.entries) {
    const start = new Date(e.actualStartAt);
    const end = new Date(e.actualEndAt);
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const hours = Math.round((minutes / 60) * 100) / 100;

    const row = [
      formatDate(start),
      formatTime(start),
      formatTime(end),
      String(minutes),
      String(hours).replace(".", ","),
      e.title,
      e.einsatzort,
      e.customerName ?? "",
      e.dienstart ?? "",
      String(e.appointmentId),
    ].map(csvEscape);

    lines.push(row.join(";"));
  }

  const csv = `\uFEFF${lines.join("\n")}\n`;
  const filename = `stundenzettel_${year}-${pad2(month)}_user-${forUserId}.csv`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
