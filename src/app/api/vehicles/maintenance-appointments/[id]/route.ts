import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicleMaintenanceAppointments, vehicleServiceCompanies } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

const canManage = (role: string) => role === "ADMIN" || role === "VERWALTUNG";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !canManage(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const id = Number((await params).id);
  const existing = await db.query.vehicleMaintenanceAppointments.findFirst({ where: (row, { eq }) => eq(row.id, id) });
  if (!existing) return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  const body = await request.json();
  const companyId = Number(body.companyId);
  const company = await db.query.vehicleServiceCompanies.findFirst({ where: (row, { eq }) => eq(row.id, companyId) });
  if (!company) return NextResponse.json({ error: "Bitte eine gültige Firma auswählen." }, { status: 400 });
  const startAt = new Date(body.startAt);
  const endAt = body.endAt ? new Date(body.endAt) : null;
  if (Number.isNaN(startAt.getTime()) || (endAt && (Number.isNaN(endAt.getTime()) || endAt <= startAt))) return NextResponse.json({ error: "Bitte gültige Termindaten eingeben." }, { status: 400 });
  await db.update(vehicleMaintenanceAppointments).set({ companyId, companyName: company.name, address: company.address, startAt, endAt }).where(eq(vehicleMaintenanceAppointments.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !canManage(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const id = Number((await params).id);
  const appointment = await db.query.vehicleMaintenanceAppointments.findFirst({ where: (row, { eq }) => eq(row.id, id) });
  if (!appointment) return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  await db.delete(vehicleMaintenanceAppointments).where(eq(vehicleMaintenanceAppointments.id, id));
  return NextResponse.json({ ok: true });
}
