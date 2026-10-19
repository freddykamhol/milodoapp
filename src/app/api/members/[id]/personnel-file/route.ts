import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { appointmentApplications, appointments, customers, documents, hourEntries, timesheetMonths, users } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { verifyPassword } from "@/lib/password";
import { buildPersonnelFile } from "@/lib/personnel-file-pdf";
import { sendSmtpMail } from "@/lib/smtp-mail";
import { readStoredDocument } from "@/lib/document-storage";

function currentDatePassword(date: Date) {
  const parts = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}${get("month")}${get("year")}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const memberId = Number((await params).id);
  if (!Number.isSafeInteger(memberId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = String(body?.password ?? "");
  if (!password || !verifyPassword(password, viewer.passwordHash)) return NextResponse.json({ ok: false, error: "password_invalid" }, { status: 403 });

  const member = await db.query.users.findFirst({ where: eq(users.id, memberId) });
  if (!member) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const [memberDocuments, hourRows, monthRows, admins] = await Promise.all([
    db.select({ title: documents.title, category: documents.category, fileName: documents.fileName, mimeType: documents.mimeType, sizeBytes: documents.sizeBytes, createdAt: documents.createdAt, expiresAt: documents.expiresAt, storageKey: documents.storageKey, ownerId: documents.ownerId }).from(documents).where(eq(documents.ownerId, memberId)).orderBy(asc(documents.createdAt), asc(documents.id)),
    db.select({ year: hourEntries.actualStartAt, startAt: hourEntries.actualStartAt, endAt: hourEntries.actualEndAt, title: appointments.title, einsatzort: appointments.einsatzort, customerName: customers.name })
      .from(hourEntries).innerJoin(appointments, eq(hourEntries.appointmentId, appointments.id)).innerJoin(customers, eq(appointments.customerId, customers.id)).where(eq(hourEntries.userId, memberId)).orderBy(asc(hourEntries.actualStartAt)),
    db.select({ year: timesheetMonths.year, month: timesheetMonths.month, status: timesheetMonths.status }).from(timesheetMonths).where(eq(timesheetMonths.userId, memberId)),
    db.select({ email: users.email }).from(users).where(and(eq(users.role, "ADMIN"), eq(users.locked, false))),
  ]);
  const documentFiles = await Promise.all(memberDocuments.map(async (item) => {
    try { return { ...item, bytes: await readStoredDocument(item) }; }
    catch { return { ...item, bytes: null }; }
  }));
  const monthStatus = new Map(monthRows.map((row) => [`${row.year}-${row.month}`, row.status]));
  const generatedAt = new Date();
  const pdfPassword = currentDatePassword(generatedAt);
  const pdf = await buildPersonnelFile({
    generatedAt,
    password: pdfPassword,
    member: {
      username: member.username,
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
      contractType: member.contractType,
      geb: member.geb,
      qualRD: member.qualRD,
      qualAusb: member.qualAusb,
      telefon: member.telefon,
      email: member.email,
      strasse: member.strasse,
      hausnummer: member.hausnummer,
      plz: member.plz,
      ort: member.ort,
      einsatzort: member.einsatzort,
      eintritt: member.eintritt,
    },
    documents: documentFiles,
    hours: hourRows.map((row) => ({ year: row.startAt.getFullYear(), month: row.startAt.getMonth() + 1, title: row.title, startAt: row.startAt, endAt: row.endAt, einsatzort: row.einsatzort, customerName: row.customerName, status: monthStatus.get(`${row.startAt.getFullYear()}-${row.startAt.getMonth() + 1}`) ?? "OPEN" })),
  });

  const actorName = `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.username;
  const recipients = admins.map((admin) => admin.email?.trim()).filter((email): email is string => Boolean(email));
  if (recipients.length) {
    await sendSmtpMail({
      to: recipients,
      subject: `[MILODO] Personalakte heruntergeladen: ${member.firstName} ${member.lastName}`.trim(),
      text: `Die Personalakte wurde heruntergeladen.\n\nMitglied: ${member.firstName} ${member.lastName}\nAusgeführt von: ${actorName}\nRolle: ${viewer.role}\nZeitpunkt: ${generatedAt.toLocaleString("de-DE")}`,
    });
  }

  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="Personalakte-${member.username}.pdf"`, "cache-control": "no-store" } });
}
