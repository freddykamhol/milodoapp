import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appointmentVehicles, vehicleDefects, vehicleMaintenances, vehicleTrips, vehicles } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

const canManage = (role: string) => role === "ADMIN" || role === "VERWALTUNG";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!canManage(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const id = Number((await params).id);
  const vehicle = await db.query.vehicles.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!vehicle) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const defects = await db.select().from(vehicleDefects).where(eq(vehicleDefects.vehicleId, id));
  return NextResponse.json({ vehicle, defects });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !canManage(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const id = Number((await params).id);
  const body = await request.json();
  const vehicle = await db.query.vehicles.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!vehicle) return NextResponse.json({ error: "Fahrzeug nicht gefunden" }, { status: 404 });

  if (body.kind === "lifecycle") {
    if (!["decommission", "restore"].includes(body.action)) return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
    await db.update(vehicles).set({ isActive: body.action === "restore", updatedAt: new Date() }).where(eq(vehicles.id, id));
    return NextResponse.json({ ok: true });
  }
  if (body.kind !== "vehicle") return NextResponse.json({ error: "Statusänderungen erfolgen auf der Mangel-Detailseite." }, { status: 400 });
  const patch: Partial<typeof vehicles.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.licensePlate === "string") patch.licensePlate = body.licensePlate.toUpperCase().trim();
  if (typeof body.location === "string") patch.location = body.location;
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (typeof body.mileage === "number" && Number.isInteger(body.mileage) && body.mileage >= 0) patch.mileage = body.mileage;
  if (body.tuvLastAt) patch.tuvLastAt = new Date(body.tuvLastAt);
  await db.update(vehicles).set(patch).where(eq(vehicles.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !canManage(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const id = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const vehicle = await db.query.vehicles.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!vehicle) return NextResponse.json({ error: "Fahrzeug nicht gefunden" }, { status: 404 });
  if (typeof body.licensePlate !== "string" || body.licensePlate.trim().toUpperCase() !== vehicle.licensePlate.toUpperCase()) {
    return NextResponse.json({ error: "Das Kennzeichen stimmt nicht überein. Das Fahrzeug wurde nicht gelöscht." }, { status: 400 });
  }
  db.transaction((tx) => {
    tx.delete(appointmentVehicles).where(eq(appointmentVehicles.vehicleId, id)).run();
    tx.delete(vehicleTrips).where(eq(vehicleTrips.vehicleId, id)).run();
    tx.delete(vehicleDefects).where(eq(vehicleDefects.vehicleId, id)).run();
    tx.delete(vehicleMaintenances).where(eq(vehicleMaintenances.vehicleId, id)).run();
    tx.delete(vehicles).where(eq(vehicles.id, id)).run();
  });
  return NextResponse.json({ ok: true });
}
