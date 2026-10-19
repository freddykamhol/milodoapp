import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

export type PersonnelFileData = {
  generatedAt: Date; password: string;
  member: { username: string; firstName: string; lastName: string; role: string; contractType: string | null; geb: Date | null; qualRD: string | null; qualAusb: string | null; telefon: string | null; email: string | null; strasse: string | null; hausnummer: string | null; plz: string | null; ort: string | null; einsatzort: string | null; eintritt: Date | null };
  documents: Array<{ title: string; category: string | null; fileName: string; mimeType: string | null; sizeBytes: number | null; createdAt: Date; expiresAt: Date | null; bytes: Buffer | null }>;
  hours: Array<{ year: number; month: number; title: string; startAt: Date; endAt: Date; einsatzort: string; customerName: string | null; status: string }>;
};

const navy = "#092342";
const blue = "#0878F9";
const pale = "#EFF6FF";
const pale2 = "#F7FAFE";
const ink = "#12233D";
const muted = "#60718A";
const line = "#D5E0ED";
const pageWidth = 595.28;
const left = 48;
const contentWidth = pageWidth - left * 2;

function date(value: Date | null) { return value ? value.toLocaleDateString("de-DE") : "-"; }
function dateTime(value: Date) { return value.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }); }
function monthLabel(year: number, month: number) { return new Date(year, month - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" }); }
function roleLabel(value: string) { return ({ ADMIN: "Admin", VERWALTUNG: "Verwaltung", PERSONAL: "Personal", KUNDE: "Kunde" } as Record<string, string>)[value] ?? value; }
function qualification(member: PersonnelFileData["member"]) { return [member.qualRD, member.qualAusb === "AUSBILDER" ? "Ausbilder" : member.qualAusb].filter(Boolean).join(" / ") || "-"; }
function duration(startAt: Date, endAt: Date) { return Math.max(0, (endAt.getTime() - startAt.getTime()) / 3_600_000); }
function formatTime(value: Date) { return value.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
function euroHours(value: number) { return `${value.toFixed(2).replace(".", ",")} h`; }

function drawHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.rect(0, 0, pageWidth, 88).fill(pale); doc.rect(0, 0, pageWidth, 5).fill(blue);
  const logoPath = path.join(process.cwd(), "public/logo/MILODO.png");
  if (fs.existsSync(logoPath)) doc.image(logoPath, left, 22, { fit: [128, 38] });
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), 365, 29, { width: 182, align: "right" });
  doc.moveTo(365, 49).lineTo(pageWidth - left, 49).lineWidth(2).stroke(blue);
  doc.x = left; doc.y = 116;
}
function footer(doc: PDFKit.PDFDocument, page: number) { doc.fillColor(muted).font("Helvetica").fontSize(7.5).text(`MILODO Medical Group  ·  Vertraulich  ·  Seite ${page}`, left, 810, { width: contentWidth, align: "center" }); }
function title(doc: PDFKit.PDFDocument, kicker: string, heading: string, subheading?: string) {
  doc.fillColor(blue).font("Helvetica-Bold").fontSize(9).text(kicker.toUpperCase(), left, doc.y);
  doc.moveDown(0.25).fillColor(navy).font("Helvetica-Bold").fontSize(25).text(heading, { width: contentWidth });
  if (subheading) doc.moveDown(0.2).fillColor(muted).font("Helvetica").fontSize(9).text(subheading, { width: contentWidth });
  doc.moveDown(1);
}
function infoCard(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number, height = 43) {
  doc.roundedRect(x, y, width, height, 7).fill(pale2).stroke(line);
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x + 10, y + 9, { width: width - 20 });
  doc.fillColor(ink).font("Helvetica").fontSize(10).text(value || "-", x + 10, y + 22, { width: width - 20, height: height - 25, ellipsis: true });
}
function newPage(doc: PDFKit.PDFDocument, header: string) { doc.addPage(); drawHeader(doc, header); }

export async function buildPersonnelFile(data: PersonnelFileData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: left, bufferPages: true, userPassword: data.password, ownerPassword: data.password, permissions: { printing: "highResolution", copying: false, modifying: false, annotating: false } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const memberName = `${data.member.firstName} ${data.member.lastName}`.trim() || data.member.username;

  drawHeader(doc, "Digitale Personalakte");
  title(doc, "Digitale Personalakte", memberName, `Erstellt am ${dateTime(data.generatedAt)}  ·  Vertraulicher Export`);
  doc.roundedRect(left, doc.y, contentWidth, 42, 8).fill(navy);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(10).text("STAMMDATENBLATT", left + 14, doc.y + 14);
  doc.fillColor("#C9D9EC").font("Helvetica").fontSize(8).text(`Rolle: ${roleLabel(data.member.role)}`, left + 330, doc.y + 15, { width: 155, align: "right" });
  doc.y += 56;
  const col = (contentWidth - 18) / 3; const c1 = left; const c2 = left + col + 9; const c3 = left + (col + 9) * 2; let y = doc.y;
  infoCard(doc, "Benutzername", data.member.username, c1, y, col); infoCard(doc, "Rolle", roleLabel(data.member.role), c2, y, col); infoCard(doc, "Vertragsart", data.member.contractType ?? "-", c3, y, col);
  y += 54; infoCard(doc, "Vorname", data.member.firstName, c1, y, col); infoCard(doc, "Nachname", data.member.lastName, c2, y, col); infoCard(doc, "Geburtsdatum", date(data.member.geb), c3, y, col);
  y += 54; infoCard(doc, "Qualifikation", qualification(data.member), c1, y, col * 2 + 9); infoCard(doc, "Telefon", data.member.telefon ?? "-", c3, y, col);
  y += 54; infoCard(doc, "E-Mail", data.member.email ?? "-", c1, y, col * 2 + 9); infoCard(doc, "Eintritt", date(data.member.eintritt), c3, y, col);
  y += 54; infoCard(doc, "Adresse", [data.member.strasse, data.member.hausnummer, data.member.plz, data.member.ort].filter(Boolean).join(" "), c1, y, col * 2 + 9); infoCard(doc, "Einsatzbereich", data.member.einsatzort ?? "-", c3, y, col);
  doc.y = y + 75; doc.fillColor(muted).font("Helvetica").fontSize(8.5).text("Das PDF ist mit dem aktuellen Datum als Passwort geschützt (TTMMJJJJ).", left, doc.y, { width: contentWidth });

  newPage(doc, "Originaldokumente");
  title(doc, "Dokumente", "Originaldokumente", "Alle Originaldateien sind zusätzlich als eingebettete PDF-Anhänge enthalten.");
  if (!data.documents.length) {
    doc.roundedRect(left, doc.y, contentWidth, 56, 8).fill(pale2).stroke(line); doc.fillColor(muted).font("Helvetica").fontSize(10).text("Keine Dokumente hinterlegt.", left + 16, doc.y + 22);
  } else {
    const headerY = doc.y; doc.roundedRect(left, headerY, contentWidth, 25, 5).fill(navy);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(8).text("DOKUMENT", left + 10, headerY + 8, { width: 230 }); doc.text("KATEGORIE", left + 250, headerY + 8, { width: 105 }); doc.text("DATUM", left + 380, headerY + 8, { width: 75, align: "right" }); doc.y = headerY + 25;
    data.documents.forEach((item, index) => { const rowY = doc.y; if (index % 2 === 0) doc.rect(left, rowY, contentWidth, 42).fill(pale); doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.5).text(item.title || item.fileName, left + 10, rowY + 8, { width: 230, ellipsis: true }); doc.fillColor(muted).font("Helvetica").fontSize(8).text(item.fileName, left + 10, rowY + 23, { width: 230, ellipsis: true }); doc.text(item.category ?? "Dokument", left + 250, rowY + 14, { width: 105, ellipsis: true }); doc.text(date(item.createdAt), left + 380, rowY + 14, { width: 75, align: "right" }); doc.y = rowY + 42; });
  }
  doc.y += 28; doc.roundedRect(left, doc.y, contentWidth, 72, 8).fill(pale).stroke(line); doc.fillColor(blue).font("Helvetica-Bold").fontSize(11).text("Originale enthalten", left + 16, doc.y + 15); doc.fillColor(muted).font("Helvetica").fontSize(9).text("Die Dateien können im PDF-Viewer über den Bereich „Anhänge“ geöffnet oder gespeichert werden.", left + 16, doc.y + 34, { width: contentWidth - 32 });
  for (const item of data.documents) if (item.bytes?.length) doc.file(item.bytes, { name: item.fileName, type: item.mimeType ?? undefined, description: `${item.title || item.fileName} · Originaldokument`, creationDate: item.createdAt });

  const total = data.hours.reduce((sum, entry) => sum + duration(entry.startAt, entry.endAt), 0); const groups = new Map<string, typeof data.hours>();
  for (const entry of data.hours) { const key = `${entry.year}-${entry.month}`; groups.set(key, [...(groups.get(key) ?? []), entry]); }
  if (!groups.size) { newPage(doc, "Stundenzettel"); title(doc, "Arbeitszeit", "Geleistete Stunden", "Keine geleisteten Dienste erfasst."); doc.roundedRect(left, doc.y, contentWidth, 70, 8).fill(pale).stroke(line); doc.fillColor(blue).font("Helvetica-Bold").fontSize(20).text("0,00 Stunden", left + 16, doc.y + 16); }
  for (const entries of groups.values()) {
    newPage(doc, "Stundenzettel"); const monthTotal = entries.reduce((sum, entry) => sum + duration(entry.startAt, entry.endAt), 0);
    title(doc, "Arbeitszeit", `Stundenzettel · ${monthLabel(entries[0].year, entries[0].month)}`, `${entries.length} Dienste · Monatsgesamtzeit ${euroHours(monthTotal)}`);
    doc.roundedRect(left, doc.y, contentWidth, 52, 8).fill(pale).stroke(line); doc.fillColor(blue).font("Helvetica-Bold").fontSize(19).text(euroHours(monthTotal).replace(" h", " Stunden"), left + 16, doc.y + 14); doc.fillColor(muted).font("Helvetica").fontSize(8.5).text(`Gesamt Personalakte: ${euroHours(total).replace(" h", " Stunden")}`, left + 320, doc.y + 20, { width: 165, align: "right" }); doc.y += 72;
    const tableY = doc.y; doc.roundedRect(left, tableY, contentWidth, 25, 5).fill(navy); doc.fillColor("white").font("Helvetica-Bold").fontSize(8).text("DATUM / DIENST", left + 10, tableY + 8, { width: 175 }); doc.text("ORT / KUNDE", left + 195, tableY + 8, { width: 190 }); doc.text("ZEIT", left + 405, tableY + 8, { width: 85, align: "right" }); doc.y = tableY + 25;
    entries.forEach((entry, index) => { const rowY = doc.y; if (index % 2 === 0) doc.rect(left, rowY, contentWidth, 43).fill(pale); doc.fillColor(ink).font("Helvetica-Bold").fontSize(8).text(date(entry.startAt), left + 10, rowY + 8, { width: 175 }); doc.font("Helvetica").text(entry.title, left + 10, rowY + 22, { width: 175, ellipsis: true }); doc.text(`${entry.einsatzort}\n${entry.customerName ?? "-"}`, left + 195, rowY + 8, { width: 190, height: 32, ellipsis: true }); doc.text(`${formatTime(entry.startAt)} – ${formatTime(entry.endAt)}\n${euroHours(duration(entry.startAt, entry.endAt))}`, left + 405, rowY + 8, { width: 85, align: "right" }); doc.y = rowY + 43; });
    doc.y += 20; doc.fillColor(muted).font("Helvetica").fontSize(8).text("Die Stunden basieren auf den hinterlegten Dienst- und Stundenzettelzeiten.", left, doc.y);
  }
  const range = doc.bufferedPageRange(); for (let index = 0; index < range.count; index += 1) { doc.switchToPage(range.start + index); footer(doc, index + 1); }
  doc.end(); return done;
}
