import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

function formatMonthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatLocalDate(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    d,
  );
}

function formatLocalTime(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(d);
}

function minutesLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${pad2(m)}m`;
}

function wrapText({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string;
  font: { widthOfTextAtSize: (t: string, s: number) => number };
  size: number;
  maxWidth: number;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  function pushCurrent() {
    if (current) lines.push(current);
    current = "";
  }

  function splitLongWord(word: string) {
    const parts: string[] = [];
    let acc = "";
    for (const ch of word) {
      const next = acc + ch;
      if (font.widthOfTextAtSize(next, size) <= maxWidth || !acc) {
        acc = next;
        continue;
      }
      parts.push(acc);
      acc = ch;
    }
    if (acc) parts.push(acc);
    return parts;
  }

  for (const word of words) {
    const safeWords = font.widthOfTextAtSize(word, size) <= maxWidth ? [word] : splitLongWord(word);
    for (const w of safeWords) {
      const next = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
        continue;
      }
      pushCurrent();
      current = w;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response("unauthorized", { status: 401 });

  const url = new URL(request.url);
  const now = new Date();
  const year = parseIntParam(url.searchParams.get("year"), now.getFullYear());
  const month = parseIntParam(url.searchParams.get("month"), now.getMonth() + 1);
  const requestedUserId = parseOptionalIntParam(url.searchParams.get("userId"));
  const forUserId =
    requestedUserId && (viewer.role === "ADMIN" || viewer.role === "VERWALTUNG") ? requestedUserId : viewer.id;
  if (month < 1 || month > 12) return new Response("invalid month", { status: 400 });

  if (forUserId !== viewer.id) {
    const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, forUserId) });
    if (!target) return new Response("unknown user", { status: 404 });
  }

  const data = await getHoursMonthData({ userId: forUserId, year, month, now });
  const monthTitle = formatMonthTitle(year, month);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 36;

  const brand = {
    accent: rgb(11 / 255, 121 / 255, 253 / 255),
    surface2: rgb(246 / 255, 249 / 255, 255 / 255),
    border: rgb(230 / 255, 235 / 255, 245 / 255),
    textMuted: rgb(120 / 255, 130 / 255, 150 / 255),
    text: rgb(11 / 255, 18 / 255, 32 / 255),
  };

  const columns = {
    date: 110,
    time: 105,
    duration: 70,
    title: 205,
  };

  function createPage(pageNumber: number) {
    const page = pdf.addPage(pageSize);
    const { width, height } = page.getSize();
    let y = height - margin;

    const headerH = 64;
    page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: brand.surface2 });
    page.drawRectangle({ x: 0, y: height - headerH, width, height: 2, color: brand.accent });

    page.drawText("Stundenzettel", { x: margin, y: height - 30, size: 16, font: fontBold, color: brand.text });
    page.drawText(monthTitle, { x: margin, y: height - 48, size: 10, font, color: brand.textMuted });

    const statusLabel = data.month.status === "CLOSED" ? "Abgeschlossen" : "Offen";
    const metaRight = `${statusLabel} • Gesamt ${minutesLabel(data.totalMinutes)}`;
    page.drawText(metaRight, {
      x: width - margin - font.widthOfTextAtSize(metaRight, 10),
      y: height - 48,
      size: 10,
      font,
      color: brand.textMuted,
    });

    y = height - headerH - 18;
    const tableX = margin;
    const tableW = width - margin * 2;
    const colOrt = tableW - columns.date - columns.time - columns.duration - columns.title;

    page.drawRectangle({
      x: tableX,
      y: y - 22,
      width: tableW,
      height: 22,
      color: brand.surface2,
      borderColor: brand.border,
      borderWidth: 1,
    });

    const th = { size: 9, font: fontBold, color: brand.textMuted };
    page.drawText("Datum", { x: tableX + 10, y: y - 15, ...th });
    page.drawText("Zeit", { x: tableX + 10 + columns.date, y: y - 15, ...th });
    page.drawText("Dauer", { x: tableX + 10 + columns.date + columns.time, y: y - 15, ...th });
    page.drawText("Titel", { x: tableX + 10 + columns.date + columns.time + columns.duration, y: y - 15, ...th });
    page.drawText("Ort / Kunde", {
      x: tableX + 10 + columns.date + columns.time + columns.duration + columns.title,
      y: y - 15,
      ...th,
    });

    y -= 22;

    const footerText = `Seite ${pageNumber}`;
    page.drawText(footerText, {
      x: width - margin - font.widthOfTextAtSize(footerText, 9),
      y: 18,
      size: 9,
      font,
      color: brand.textMuted,
    });

    return { page, y, tableX, tableW, colOrt };
  }

  let pageNumber = 1;
  let { page, y, tableX, tableW, colOrt } = createPage(pageNumber);
  const lineH = 12;
  const padY = 8;

  function ensureSpace(needed: number) {
    if (y - needed >= margin + 22) return;
    pageNumber += 1;
    ({ page, y, tableX, tableW, colOrt } = createPage(pageNumber));
  }

  for (let index = 0; index < data.entries.length; index += 1) {
    const e = data.entries[index];
    const start = new Date(e.actualStartAt);
    const end = new Date(e.actualEndAt);
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

    const dateText = formatLocalDate(start);
    const timeText = `${formatLocalTime(start)} – ${formatLocalTime(end)}`;
    const durationText = minutesLabel(minutes);
    const titleText = e.title;
    const locationText = `${e.customerName ?? "—"} • ${e.einsatzort}`;

    const dateLines = wrapText({ text: dateText, font, size: 9, maxWidth: columns.date - 16 });
    const timeLines = wrapText({ text: timeText, font, size: 9, maxWidth: columns.time - 16 });
    const durationLines = wrapText({ text: durationText, font, size: 9, maxWidth: columns.duration - 16 });
    const titleLines = wrapText({ text: titleText, font: fontBold, size: 9, maxWidth: columns.title - 16 });
    const locLines = wrapText({ text: locationText, font, size: 9, maxWidth: colOrt - 16 });

    const maxLines = Math.max(
      dateLines.length,
      timeLines.length,
      durationLines.length,
      titleLines.length,
      locLines.length,
    );
    const rowH = padY * 2 + maxLines * lineH;
    ensureSpace(rowH + 1);

    page.drawRectangle({
      x: tableX,
      y: y - rowH,
      width: tableW,
      height: rowH,
      borderColor: brand.border,
      borderWidth: 1,
      color: index % 2 === 0 ? rgb(1, 1, 1) : brand.surface2,
    });

    const baseY = y - padY - 9;

    function drawLines(lines: string[], x: number, bold = false) {
      for (let i = 0; i < lines.length; i += 1) {
        page.drawText(lines[i], {
          x,
          y: baseY - i * lineH,
          size: 9,
          font: bold ? fontBold : font,
          color: brand.text,
        });
      }
    }

    let x = tableX + 10;
    drawLines(dateLines, x);
    x += columns.date;
    drawLines(timeLines, x);
    x += columns.time;
    drawLines(durationLines, x);
    x += columns.duration;
    drawLines(titleLines, x, true);
    x += columns.title;
    drawLines(locLines, x);

    y -= rowH;
  }

  const bytes = await pdf.save();
  const filename = `stundenzettel_${year}-${pad2(month)}_user-${forUserId}.pdf`;

  const body = Buffer.from(bytes);
  return new Response(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
