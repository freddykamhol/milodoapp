import fs from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { dateFormatter } from "./date-format";

type Staff = {
  firstName: string;
  lastName: string;
  username: string;
  qualRD: string | null;
  qualAusb: string | null;
  telefon: string | null;
  role: string;
};

type Vehicle = {
  licensePlate: string;
  type: string;
  members: Staff[];
};

export type AppointmentDutyPlanData = {
  id: number;
  title: string;
  startAt: Date;
  endAt: Date | null;
  einsatzort: string;
  customerName: string;
  staff: Staff[];
  vehicles: Vehicle[];
};

const W = 595.28;
const H = 841.89;
const M = 46;
const CW = W - M * 2;
const navy = rgb(0.035, 0.12, 0.24);
const blue = rgb(0.035, 0.40, 0.91);
const pale = rgb(0.94, 0.97, 1);
const ink = rgb(0.08, 0.12, 0.18);
const muted = rgb(0.36, 0.42, 0.50);
const line = rgb(0.84, 0.88, 0.93);
const white = rgb(1, 1, 1);

let assetPromise: Promise<{ regular: Buffer; bold: Buffer; logo: Buffer }> | undefined;

async function loadAssets() {
  assetPromise ??= Promise.all([
    fs.readFile(path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf")),
    fs.readFile(path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf")),
    fs.readFile(path.join(process.cwd(), "public/logo/MILODO.png")),
  ]).then(([regular, bold, logo]) => ({ regular, bold, logo }));
  return assetPromise;
}

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const result: string[] = [];
  let current = "";
  for (const word of String(value || "").split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) current = next;
    else if (current) { result.push(current); current = word; }
    else { result.push(word); current = ""; }
  }
  if (current) result.push(current);
  return result.length ? result : [""];
}

function drawText(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, width = CW, color = ink) {
  const rows = wrap(value, font, size, width);
  rows.forEach((row, index) => page.drawText(row, { x, y: y - index * (size + 4), font, size, color }));
  return y - rows.length * (size + 4);
}

function qualification(staff: Staff) {
  const values: string[] = [];
  if (staff.qualRD) values.push(({ NFS: "Notfallsanitäter", RA: "Rettungsassistent", RS: "Rettungssanitäter", RH: "Rettungshelfer", SAN: "Sanitäter" } as Record<string, string>)[staff.qualRD] ?? staff.qualRD);
  if (staff.qualAusb) values.push("Ausbilder");
  return values.join(" / ") || "-";
}

function shortQualification(staff: Staff) {
  return [staff.qualRD, staff.qualAusb ? "AUSB" : ""].filter(Boolean).join(" / ") || "-";
}

function formatDate(date: Date) { return dateFormatter({ weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function formatTime(date: Date) { return dateFormatter({ hour: "2-digit", minute: "2-digit" }).format(date); }

function header(page: PDFPage, logo: PDFImage, bold: PDFFont, label: string) {
  page.drawRectangle({ x: 0, y: H - 104, width: W, height: 104, color: pale });
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: blue });
  const scale = Math.min(125 / logo.width, 33 / logo.height);
  page.drawImage(logo, { x: M, y: H - 78, width: logo.width * scale, height: logo.height * scale });
  page.drawText(label.toUpperCase(), { x: W - M - 210, y: H - 47, font: bold, size: 9.5, color: navy, maxWidth: 210 });
  page.drawLine({ start: { x: W - M - 210, y: H - 60 }, end: { x: W - M, y: H - 60 }, color: blue, thickness: 2 });
}

function footer(page: PDFPage, pageNumber: number, regular: PDFFont, id: number) {
  page.drawLine({ start: { x: M, y: 42 }, end: { x: W - M, y: 42 }, color: line, thickness: 0.8 });
  page.drawText(`Dienstplan #${id}  |  Seite ${pageNumber}  |  Vertraulich`, { x: M, y: 27, font: regular, size: 8, color: muted });
}

export async function buildAppointmentDutyPlan(data: AppointmentDutyPlanData) {
  const files = await loadAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(files.regular, { subset: true });
  const bold = await pdf.embedFont(files.bold, { subset: true });
  const logo = await pdf.embedPng(files.logo);
  pdf.setTitle(`Dienstplan - ${data.title}`);

  let pageNumber = 0;
  let page!: PDFPage;
  let y = 0;
  const newPage = (title: string) => {
    pageNumber += 1;
    page = pdf.addPage([W, H]);
    header(page, logo, bold, "Dienstplanung");
    y = drawText(page, title, M, 718, bold, 24, CW, navy) - 8;
    y = drawText(page, data.title, M, y, bold, 13, CW, blue) - 5;
    y = drawText(page, `${formatDate(data.startAt)}  |  ${formatTime(data.startAt)}${data.endAt ? ` - ${formatTime(data.endAt)}` : ""} Uhr`, M, y, regular, 10, CW, muted) - 2;
    y = drawText(page, `${data.customerName}  |  ${data.einsatzort}`, M, y, regular, 10, CW, muted) - 13;
    footer(page, pageNumber, regular, data.id);
  };
  const ensure = (height: number, title: string) => { if (y - height < 62) newPage(title); };

  newPage("Einteilungsübersicht");
  // Keep the complete table inside the printable A4 width (CW = 503.28).
  const cols = [34, 112, 122, 145, 90];
  const headings = ["Nr.", "Vorname", "Nachname", "Qualifikation", "Telefon"];
  const drawTableHeader = () => {
    page.drawRectangle({ x: M, y: y - 25, width: CW, height: 25, color: navy });
    let x = M;
    headings.forEach((heading, index) => { drawText(page, heading, x + 7, y - 17, bold, 8, cols[index] - 14, white); x += cols[index]; });
    y -= 34;
  };
  drawTableHeader();
  data.staff.forEach((person, index) => {
    const values = [String(index + 1), person.firstName || person.username, person.lastName || "-", shortQualification(person), person.telefon || "-"];
    const rowHeight = 32;
    const previousPage = pageNumber;
    ensure(rowHeight + 4, "Einteilungsübersicht");
    if (pageNumber !== previousPage) drawTableHeader();
    if (index % 2 === 0) page.drawRectangle({ x: M, y: y - rowHeight + 6, width: CW, height: rowHeight, color: pale });
    let x = M;
    values.forEach((value, column) => { drawText(page, value, x + 7, y - 19, column === 1 || column === 2 ? bold : regular, 8.5, cols[column] - 14); x += cols[column]; });
    page.drawLine({ start: { x: M, y: y - rowHeight + 5 }, end: { x: W - M, y: y - rowHeight + 5 }, color: line, thickness: 0.5 });
    y -= rowHeight;
  });
  if (!data.staff.length) drawText(page, "Noch kein Personal eingeteilt.", M + 8, y - 18, regular, 10, CW - 16, muted);

  newPage("Fahrzeugübersicht");
  data.vehicles.forEach((vehicle) => {
    const blockHeight = 34 + Math.max(1, vehicle.members.length) * 25;
    ensure(blockHeight + 10, "Fahrzeugübersicht");
    page.drawRectangle({ x: M, y: y - 38, width: CW, height: 38, color: navy });
    drawText(page, vehicle.licensePlate, M + 14, y - 17, bold, 12, 190, white);
    drawText(page, vehicle.type, M + 235, y - 17, regular, 9, CW - 250, rgb(0.78, 0.86, 0.96));
    drawText(page, `${vehicle.members.length} ${vehicle.members.length === 1 ? "Person" : "Personen"}`, W - M - 92, y - 17, regular, 8.5, 78, rgb(0.78, 0.86, 0.96));
    y -= 45;
    if (!vehicle.members.length) { drawText(page, "Noch niemand zugeordnet.", M + 16, y - 12, regular, 9, CW - 32, muted); y -= 28; return; }
    vehicle.members.forEach((person, index) => {
      if (index % 2 === 0) page.drawRectangle({ x: M + 8, y: y - 22, width: CW - 16, height: 22, color: pale });
      drawText(page, `${person.firstName || person.username} ${person.lastName}`.trim(), M + 18, y - 15, bold, 9, 210);
      drawText(page, qualification(person), M + 235, y - 15, regular, 8.5, 170, muted);
      drawText(page, person.telefon || "-", M + 420, y - 15, regular, 8.5, 105, ink);
      y -= 25;
    });
    y -= 12;
  });
  if (!data.vehicles.length) drawText(page, "Für diesen Dienst wurden keine Fahrzeuge zugeordnet.", M, y, regular, 10, CW, muted);

  return Buffer.from(await pdf.save());
}
