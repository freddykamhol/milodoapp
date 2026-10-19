import {loadCalendarExportRows} from "@/lib/calendar-read-model";

import { getViewer } from "@/lib/viewer";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIcsUtc(date: Date) {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(
    date.getUTCHours(),
  )}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const to = parseDate(url.searchParams.get("to"), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

  const viewer = await getViewer();
  if (!viewer) return new Response("unauthorized", { status: 401 });
  const rows = await loadCalendarExportRows(viewer,from,to);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//milodo//Calendar//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:milodo (zugesagt)",
    "X-WR-CALDESC:Dauersynchroner, schreibgeschuetzter Kalender (Read-only).",
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  const dtstamp = toIcsUtc(new Date());

  for (const row of rows) {
    const uid = `${row.eventId}@milodo`;
    const dtstart = toIcsUtc(row.startAt);
    const dtend = toIcsUtc(row.endAt ?? new Date(row.startAt.getTime() + 60 * 60 * 1000));
    const summary = escapeIcs(row.title);
    const location = escapeIcs([row.customerName,row.einsatzort].filter(Boolean).join(" – "));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`LOCATION:${location}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="milodo-webcal.ics"',
      "cache-control": "no-store, max-age=0",
    },
  });
}
