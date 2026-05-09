import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, asc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications, appointments, customers } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

function formatLocal(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLocalDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatLocalTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(date);
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
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const to = parseDate(url.searchParams.get("to"), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  const viewer = await getViewer();
  if (!viewer) return new Response("unauthorized", { status: 401 });
  const userId = viewer.id;
  const rows = await db
    .select({
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      einsatzort: appointments.einsatzort,
      customerName: customers.name,
      dienstart: appointments.dienstart,
    })
    .from(appointmentApplications)
    .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(
      and(
        eq(appointmentApplications.userId, userId),
        eq(appointmentApplications.status, "CONFIRMED"),
        gte(appointments.startAt, from),
        lt(appointments.startAt, to),
        eq(appointments.state, "OPEN"),
      ),
    )
    .orderBy(asc(appointments.startAt));

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
    time: 120,
    type: 52,
    title: 220,
  };

  function createPage(pageNumber: number) {
    const page = pdf.addPage(pageSize);
    const { width, height } = page.getSize();
    let y = height - margin;

    // header band
    const headerH = 56;
    page.drawRectangle({
      x: 0,
      y: height - headerH,
      width,
      height: headerH,
      color: brand.surface2,
    });
    page.drawRectangle({
      x: 0,
      y: height - headerH,
      width,
      height: 2,
      color: brand.accent,
    });

    page.drawText("Zugesagte Termine", {
      x: margin,
      y: height - 30,
      size: 16,
      font: fontBold,
      color: brand.text,
    });
    page.drawText(`${formatLocalDate(from)} – ${formatLocalDate(to)}`, {
      x: margin,
      y: height - 46,
      size: 9,
      font,
      color: brand.textMuted,
    });

    const generated = `Erstellt: ${formatLocal(new Date())}`;
    page.drawText(generated, {
      x: width - margin - font.widthOfTextAtSize(generated, 9),
      y: height - 46,
      size: 9,
      font,
      color: brand.textMuted,
    });

    // table header
    y = height - headerH - 18;
    const tableX = margin;
    const tableW = width - margin * 2;
    const colOrt = tableW - columns.time - columns.type - columns.title;

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
    page.drawText("Zeit", { x: tableX + 10, y: y - 15, ...th });
    page.drawText("Typ", { x: tableX + 10 + columns.time, y: y - 15, ...th });
    page.drawText("Titel", { x: tableX + 10 + columns.time + columns.type, y: y - 15, ...th });
    page.drawText("Ort / Kunde", {
      x: tableX + 10 + columns.time + columns.type + columns.title,
      y: y - 15,
      ...th,
    });

    y -= 22;

    // footer
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

  function drawRow(
    row: (typeof rows)[number],
    index: number,
  ) {
    const dateText = formatLocalDate(row.startAt);
    const timeText = `${formatLocalTime(row.startAt)} – ${row.endAt ? formatLocalTime(row.endAt) : "—"}`;
    const typeText = row.dienstart ?? "—";
    const titleText = row.title;
    const locationText = `${row.customerName}\n${row.einsatzort}`;

    const timeLines = [
      ...wrapText({ text: dateText, font, size: 9, maxWidth: columns.time - 16 }),
      ...wrapText({ text: timeText, font, size: 9, maxWidth: columns.time - 16 }),
    ];
    const typeLines = wrapText({ text: typeText, font, size: 9, maxWidth: columns.type - 16 });
    const titleLines = wrapText({ text: titleText, font: fontBold, size: 9, maxWidth: columns.title - 16 });
    const locLines = locationText
      .split("\n")
      .flatMap((t) => wrapText({ text: t, font, size: 9, maxWidth: colOrt - 16 }));

    const maxLines = Math.max(timeLines.length, typeLines.length, titleLines.length, locLines.length);
    const rowH = padY * 2 + maxLines * lineH;

    ensureSpace(rowH + 1);

    const bg = index % 2 === 0 ? rgb(1, 1, 1) : brand.surface2;
    page.drawRectangle({
      x: tableX,
      y: y - rowH,
      width: tableW,
      height: rowH,
      color: bg,
      borderColor: brand.border,
      borderWidth: 1,
    });

    const xTime = tableX + 10;
    const xType = tableX + 10 + columns.time;
    const xTitle = tableX + 10 + columns.time + columns.type;
    const xLoc = tableX + 10 + columns.time + columns.type + columns.title;

    for (let i = 0; i < maxLines; i += 1) {
      const yy = y - padY - (i + 1) * lineH + 4;

      page.drawText(timeLines[i] ?? "", { x: xTime, y: yy, size: 9, font, color: brand.textMuted });
      page.drawText(typeLines[i] ?? "", { x: xType, y: yy, size: 9, font, color: brand.text });
      page.drawText(titleLines[i] ?? "", { x: xTitle, y: yy, size: 9, font: fontBold, color: brand.text });
      page.drawText(locLines[i] ?? "", { x: xLoc, y: yy, size: 9, font, color: brand.text });
    }

    y -= rowH;
  }

  // column separators (draw once per page would be nicer; keep simple per row via borders)
  for (let idx = 0; idx < rows.length; idx += 1) {
    drawRow(rows[idx], idx);
  }

  const bytes = await pdf.save();

  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="milodo-confirmed.pdf"',
    },
  });
}
