import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicleMaintenanceAppointments, vehicleMaintenances, vehicleServiceCompanies } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !["ADMIN", "VERWALTUNG"].includes(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const maintenanceKey = (await params).id;
  const body = await request.json();
  let maintenanceId: number | null = null;
  let vehicleId: number;
  let title: string;
  if (maintenanceKey === "tuv") {
    vehicleId = Number(body.vehicleId);
    const vehicle = await db.query.vehicles.findFirst({ where: (row, { eq }) => eq(row.id, vehicleId) });
    if (!vehicle) return NextResponse.json({ error: "Fahrzeug nicht gefunden" }, { status: 404 });
    title = "TÜV-Prüfung";
  } else {
    maintenanceId = Number(maintenanceKey);
    const maintenance = await db.query.vehicleMaintenances.findFirst({ where: (row, { eq }) => eq(row.id, maintenanceId!) });
    if (!maintenance) return NextResponse.json({ error: "Wartungsintervall nicht gefunden" }, { status: 404 });
    vehicleId = maintenance.vehicleId;
    title = maintenance.title;
  }
  const companyId = Number(body.companyId);
  const company = await db.query.vehicleServiceCompanies.findFirst({ where: (row, { eq }) => eq(row.id, companyId) });
  if (!company) return NextResponse.json({ error: "Bitte eine gültige Firma auswählen." }, { status: 400 });
  const startAt = new Date(body.startAt);
  const endAt = body.endAt ? new Date(body.endAt) : null;
  if (Number.isNaN(startAt.getTime()) || (endAt && (Number.isNaN(endAt.getTime()) || endAt <= startAt))) return NextResponse.json({ error: "Bitte gültige Termindaten eingeben." }, { status: 400 });
  const [appointment] = await db.insert(vehicleMaintenanceAppointments).values({
    vehicleId,
    maintenanceId,
    companyId,
    companyName: company.name,
    address: company.address,
    title,
    startAt,
    endAt,
    createdById: viewer.id,
  }).returning({ id: vehicleMaintenanceAppointments.id });
  return NextResponse.json({ id: appointment.id });
}
