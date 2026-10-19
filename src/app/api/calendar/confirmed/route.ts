import { loadCalendarEvents } from "@/lib/calendar-read-model";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/viewer";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const to = parseDate(url.searchParams.get("to"), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  return NextResponse.json(await loadCalendarEvents(viewer,from,to));
}
