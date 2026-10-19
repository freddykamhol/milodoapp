import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicleMaintenanceAppointments, vehicleMaintenances, vehicles } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

const authorized = (role: string) => role === "ADMIN" || role === "VERWALTUNG";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !authorized(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const id = (await params).id;
  const body = await request.json();

  if (id === "tuv") {
    if (body.action !== "done") return NextResponse.json({ error: "Diese TÜV-Aktion wird hier nicht unterstützt." }, { status: 400 });
    const completedAt = new Date(body.completedAt);
    if (Number.isNaN(completedAt.getTime())) return NextResponse.json({ error: "Ungültiges Erledigungsdatum" }, { status: 400 });
    const vehicleId = Number(body.vehicleId);
    const vehicle = await db.query.vehicles.findFirst({ where: (row, { eq }) => eq(row.id, vehicleId) });
    if (!vehicle) return NextResponse.json({ error: "Fahrzeug nicht gefunden" }, { status: 404 });
    await db.update(vehicles).set({ tuvLastAt: completedAt, updatedAt: new Date() }).where(eq(vehicles.id, vehicleId));
    return NextResponse.json({ ok: true, nextAt: new Date(completedAt.getTime() + 2 * 365 * 86400000) });
  }

  const maintenanceId = Number(id);
  if (!Number.isInteger(maintenanceId)) return NextResponse.json({ error: "Ungültiges Wartungsintervall" }, { status: 400 });
  const maintenance = await db.query.vehicleMaintenances.findFirst({ where: (row, { eq }) => eq(row.id, maintenanceId) });
  if (!maintenance) return NextResponse.json({ error: "Wartungsintervall nicht gefunden" }, { status: 404 });

  if (body.action === "done") {
    const completedAt = new Date(body.completedAt);
    if (Number.isNaN(completedAt.getTime())) return NextResponse.json({ error: "Ungültiges Erledigungsdatum" }, { status: 400 });
    const nextAt = new Date(completedAt.getTime() + maintenance.intervalDays * 86400000);
    await db.update(vehicleMaintenances).set({ lastAt: completedAt, nextAt, confirmedAt: new Date() }).where(eq(vehicleMaintenances.id, maintenanceId));
    return NextResponse.json({ ok: true, nextAt });
  }
  if (body.action === "edit") {
    const title = String(body.title ?? "").trim();
    const lastAt = new Date(body.lastAt);
    const intervalDays = Number(body.intervalDays);
    if (!title || Number.isNaN(lastAt.getTime()) || !Number.isInteger(intervalDays) || intervalDays < 1) return NextResponse.json({ error: "Bitte Titel, letztes Wartungsdatum und ein gültiges Intervall angeben." }, { status: 400 });
    const nextAt = new Date(lastAt.getTime() + intervalDays * 86400000);
    await db.update(vehicleMaintenances).set({ title, lastAt, intervalDays, nextAt }).where(eq(vehicleMaintenances.id, maintenanceId));
    await db.update(vehicleMaintenanceAppointments).set({ title }).where(eq(vehicleMaintenanceAppointments.maintenanceId, maintenanceId));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unbekannte Wartungsaktion" }, { status: 400 });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !authorized(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const id = (await params).id;
  if (id === "tuv" || !Number.isInteger(Number(id))) return NextResponse.json({ error: "Wartungsintervall nicht gefunden" }, { status: 404 });
  const maintenanceId = Number(id);
  const maintenance = await db.query.vehicleMaintenances.findFirst({ where: (row, { eq }) => eq(row.id, maintenanceId) });
  if (!maintenance) return NextResponse.json({ error: "Wartungsintervall nicht gefunden" }, { status: 404 });
  await db.delete(vehicleMaintenances).where(eq(vehicleMaintenances.id, maintenanceId));
  return NextResponse.json({ ok: true });
}
