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

function formatDate(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function csvEscape(value: string) {
  const s = String(value ?? "");
  if (/[";\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const to = parseDate(url.searchParams.get("to"), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  const viewer = await getViewer();
  if (!viewer) return new Response("unauthorized", { status: 401 });
  const rows = await loadCalendarExportRows(viewer,from,to);

  const header = ["Datum", "Start", "Ende", "DauerMinuten", "Titel", "Einsatzort", "Kunde", "Bereich", "Dienstart", "Notiz"];
  const lines = [header.map(csvEscape).join(";")];

  for (const row of rows) {
    const start = row.startAt;
    const end = row.endAt;
    const minutes = end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : "";
    const note = [`Kunde: ${row.customerName}`, `Ort: ${row.einsatzort}`].join("\n");
    lines.push(
      [
        formatDate(start),
        formatTime(start),
        end ? formatTime(end) : "",
        String(minutes),
        row.title,
        row.einsatzort,
        row.customerName,
        row.bereich,
        row.dienstart ?? "",
        note,
      ].map((v) => csvEscape(String(v ?? ""))).join(";"),
    );
  }

  const body = `\uFEFF${lines.join("\n")}\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="milodo-confirmed.csv"',
    },
  });
}
