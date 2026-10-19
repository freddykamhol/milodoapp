import fs from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import {PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage} from 'pdf-lib';
import {courseType, type CourseData, type CourseParticipant} from './course-types';
import {dateFormatter} from './date-format';

const W = 595.28, H = 841.89, M = 54, CW = W - M * 2;
const navy = rgb(.035, .12, .24), blue = rgb(.035, .40, .91), pale = rgb(.93, .97, 1);
const ink = rgb(.08, .12, .18), muted = rgb(.36, .42, .50), line = rgb(.84, .88, .93), white = rgb(1, 1, 1);
let assets: Promise<{regular: Buffer; bold: Buffer; logo: Buffer}> | undefined;

async function document() {
  assets ??= Promise.all([
    fs.readFile(path.join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf')),
    fs.readFile(path.join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf')),
    fs.readFile(path.join(process.cwd(), 'public/logo/MILODO.png')),
  ]).then(([regular, bold, logo]) => ({regular, bold, logo}));
  const files = await assets, pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(files.regular, {subset: true}), heading = await pdf.embedFont(files.bold, {subset: true}), logo = await pdf.embedPng(files.logo);
  pdf.setCreator('MILODO medical'); pdf.setProducer('MILODO Kursverwaltung'); return {pdf, font, heading, logo};
}
function lines(value: string, font: PDFFont, size: number, width: number) {
  const result: string[] = []; let current = '';
  for (const paragraph of String(value).replace(/[\r\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').split('\n')) {
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize((current ? current + ' ' : '') + word, size) <= width) { current += (current ? ' ' : '') + word; continue; }
      if (current) result.push(current); current = '';
      for (const character of word) { if (current && font.widthOfTextAtSize(current + character, size) > width) { result.push(current); current = ''; } current += character; }
    }
    if (current) result.push(current); current = '';
  }
  return result.length ? result : [''];
}
function text(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, width = CW, color = ink, gap = 5) {
  const wrapped = lines(value, font, size, width); wrapped.forEach((v, i) => page.drawText(v, {x, y: y - i * (size + gap), font, size, color})); return y - wrapped.length * (size + gap);
}
const date = (value: string) => dateFormatter({dateStyle: 'medium'}).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
const time = (value: string) => dateFormatter({timeStyle: 'short'}).format(new Date(value));
function footer(page: PDFPage, label: string, font: PDFFont) { page.drawLine({start: {x: M, y: 42}, end: {x: W - M, y: 42}, color: line, thickness: .8}); text(page, label, M, 27, font, 8, CW, muted, 3); }
function header(page: PDFPage, logo: PDFImage, heading: PDFFont, label: string, dark = false) {
  page.drawRectangle({x: 0, y: H - 104, width: W, height: 104, color: pale});
  page.drawRectangle({x: 0, y: H - 6, width: W, height: 6, color: blue});
  page.drawLine({start: {x: M, y: H - 104}, end: {x: W - M, y: H - 104}, color: rgb(.78, .86, .95), thickness: 1});
  const scale = Math.min(125 / logo.width, 33 / logo.height);
  page.drawImage(logo, {x: M, y: H - 78, width: logo.width * scale, height: logo.height * scale});
  page.drawText(label.toUpperCase(), {x: W - M - 210, y: H - 47, font: heading, size: 9.5, color: navy, maxWidth: 210});
  page.drawLine({start: {x: W - M - 210, y: H - 60}, end: {x: W - M, y: H - 60}, color: blue, thickness: 2});
}

export async function buildParticipantList(data: CourseData) {
  const {pdf, font, heading, logo} = await document(); pdf.setTitle('Teilnehmerliste - ' + data.title);
  let page: PDFPage, y = 0, pageNumber = 0;
  const columns = [{label: 'Nr.', width: 32}, {label: 'Vorname', width: 120}, {label: 'Nachname', width: 130}, {label: 'Geburtsdatum', width: 92}, {label: 'Anwesenheit', width: 125}];
  function newPage() {
    pageNumber++; page = pdf.addPage([W, H]); header(page, logo, heading, 'Kursverwaltung');
    y = text(page, 'Teilnehmerliste', M, 721, heading, 25, CW, navy, 7) - 4;
    y = text(page, data.title, M, y, heading, 13, CW, blue, 4) - 9;
    y = text(page, `${courseType(data.courseType)?.label ?? 'Kursart noch nicht hinterlegt'}  ·  ${date(data.startAt)}  ·  ${time(data.startAt)}${data.endAt ? ' - ' + time(data.endAt) : ''}`, M, y, font, 10, CW, muted, 4) - 2;
    y = text(page, `${data.location}  ·  ${data.customerName}`, M, y, font, 10, CW, muted, 4) - 10;
    page.drawRectangle({x: M, y: y - 29, width: CW, height: 29, color: navy});
    text(page, `${data.participants.length} Teilnehmer`, M + 10, y - 19, heading, 8.5, 145, white, 3); text(page, `${data.participants.filter(p => p.present).length} anwesend`, M + 165, y - 19, heading, 8.5, 145, rgb(.65, 1, .82), 3); text(page, `${data.participants.filter(p => !p.present).length} nicht anwesend`, M + 325, y - 19, heading, 8.5, 160, rgb(1, .82, .72), 3);
    y -= 53; page.drawRectangle({x: M, y: y - 27, width: CW, height: 27, color: pale}); let x = M;
    for (const column of columns) { text(page, column.label, x + 8, y - 18, heading, 8, column.width - 16, muted, 3); x += column.width; } y -= 35; footer(page, `Kurs #${data.id}  ·  Seite ${pageNumber}  ·  Vertraulich - nur zur Kursorganisation`, font);
  }
  newPage();
  for (const [index, person] of data.participants.entries()) {
    const values = [String(index + 1), person.firstName, person.lastName, date(person.dateOfBirth), person.present ? 'Anwesend' : 'Nicht anwesend'];
    const wrapped = values.map((value, i) => lines(value, font, 9, columns[i].width - 16)), rowHeight = Math.max(...wrapped.map(row => row.length)) * 14 + 20;
    if (y - rowHeight < 62) newPage(); if (index % 2 === 0) page!.drawRectangle({x: M, y: y - rowHeight + 5, width: CW, height: rowHeight, color: rgb(.985, .99, .998)});
    let x = M; for (let i = 0; i < values.length; i++) { text(page!, values[i], x + 8, y - 18, font, 9, columns[i].width - 16, i === 4 && person.present ? rgb(.04, .42, .25) : ink, 4); x += columns[i].width; }
    y -= rowHeight; page!.drawLine({start: {x: M, y}, end: {x: W - M, y}, color: line, thickness: .5});
  }
  return Buffer.from(await pdf.save());
}

function certificate(pdf: PDFDocument, font: PDFFont, heading: PDFFont, logo: PDFImage, data: CourseData, person: CourseParticipant) {
  const page = pdf.addPage([W, H]), info = courseType(data.courseType)!; header(page, logo, heading, 'Kurse & Ausbildung', true);
  page.drawRectangle({x: M, y: 115, width: CW, height: 1, color: blue}); let y = text(page, 'Teilnahmebescheinigung', M, 680, heading, 27, CW, navy, 8) - 17;
  y = text(page, 'Hiermit bestätigen wir die Teilnahme von', M, y, font, 11, CW, muted, 5) - 25; y = text(page, person.firstName + ' ' + person.lastName, M, y, heading, person.firstName.length + person.lastName.length > 100 ? 19 : 26, CW, blue, 7) - 10;
  y = text(page, 'geboren am ' + date(person.dateOfBirth), M, y, font, 11, CW, muted, 5) - 28; y = text(page, 'an folgendem Lehrgang:', M, y, font, 11, CW, muted, 5) - 13; y = text(page, info.label, M, y, heading, 17, CW, navy, 6) - 13;
  y = text(page, `${info.units} Unterrichtseinheiten à 45 Minuten  ·  ${info.units * 45} Minuten Unterricht`, M, y, font, 11, CW, ink, 5) - 7; if (info.pauseMinutes) y = text(page, `Zusätzlich ${info.pauseMinutes} Minuten Pause`, M, y, font, 10, CW, muted, 5) - 8;
  y = text(page, `${date(data.startAt)}  ·  ${time(data.startAt)}${data.endAt ? ' - ' + time(data.endAt) : ''} Uhr`, M, y, heading, 12, CW, navy, 5) - 12; y = text(page, 'Kursort: ' + data.location, M, y, font, 10, CW, ink, 5) - 5; text(page, 'Auftraggeber: ' + data.customerName, M, y, font, 10, CW, ink, 5);
  page.drawLine({start: {x: M, y: 156}, end: {x: 236, y: 156}, color: line, thickness: 1}); page.drawLine({start: {x: 315, y: 156}, end: {x: W - M, y: 156}, color: line, thickness: 1}); text(page, 'Ort, Datum', M, 138, font, 9, 182, muted, 3); text(page, 'Unterschrift Kursleitung / Stempel', 315, 138, font, 9, 226, muted, 3); footer(page, `Kurs #${data.id}  ·  Teilnehmer #${person.id}  ·  MILODO medical`, font);
}

function crc32(buffer: Buffer) { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
export function createCourseZip(entries: Array<{name: string; content: Buffer}>) {
  const chunks: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const entry of entries) { const name = Buffer.from(entry.name, 'utf8'); if (entry.name.includes('..') || /[\\/]/.test(entry.name)) throw new Error('Ungültiger ZIP-Dateiname.'); const checksum = crc32(entry.content), header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12); header.writeUInt32LE(checksum, 14); header.writeUInt32LE(entry.content.length, 18); header.writeUInt32LE(entry.content.length, 22); header.writeUInt16LE(name.length, 26); chunks.push(header, name, entry.content); const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x800, 8); record.writeUInt16LE(33, 14); record.writeUInt32LE(checksum, 16); record.writeUInt32LE(entry.content.length, 20); record.writeUInt32LE(entry.content.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42); central.push(record, name); offset += header.length + name.length + entry.content.length; }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16); return Buffer.concat([...chunks, directory, end]);
}
export async function buildCourseCertificates(data: CourseData) {
  if (!courseType(data.courseType)) throw new Error('Kursart fehlt.'); const present = data.participants.filter(person => person.present); if (!present.length) throw new Error('Keine anwesenden Teilnehmer.');
  const {pdf, font, heading, logo} = await document(); pdf.setTitle('Teilnahmebescheinigungen - ' + data.title); for (const person of present) certificate(pdf, font, heading, logo, data, person);
  const combined = Buffer.from(await pdf.save()), entries: Array<{name: string; content: Buffer}> = [];
  for (const [index, person] of present.entries()) { const single = await PDFDocument.create(); const [page] = await single.copyPages(pdf, [index]); single.addPage(page); const name = (person.lastName + '-' + person.firstName).normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100); entries.push({name: `Bescheinigung-${person.id}-${name}.pdf`, content: Buffer.from(await single.save())}); }
  entries.push({name: 'Alle-Teilnahmebescheinigungen.pdf', content: combined}); return createCourseZip(entries);
}
