import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appointmentVehicleMembers, appointmentVehicles, appointmentApplications, appointments, customers, users, vehicles } from "@/db/schema";
import type { ServiceVehicle } from "@/lib/asset-types";
import { getViewer } from "@/lib/viewer";

const admin = (role: string) => role === "ADMIN" || role === "VERWALTUNG";
const result = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer(); if (!viewer) return result({ error: "no_viewer" }, 401);
  const appointmentId = Number((await params).id);
  if (!Number.isSafeInteger(appointmentId)) return result({ error: "invalid_id" }, 400);
  if (viewer.role === "KUNDE") {
    const [owned] = await db.select({ id: appointments.id }).from(appointments).innerJoin(customers, eq(appointments.customerId, customers.id)).where(and(eq(appointments.id, appointmentId), eq(customers.accountUserId, viewer.id))).limit(1);
    if (!owned) return result({ error: "forbidden" }, 403);
  }
  const rows = await db.select({ assignment: appointmentVehicles, vehicle: { id: vehicles.id, licensePlate: vehicles.licensePlate, type: vehicles.type }, member: { userId: users.id, username: users.username, qualRD: users.qualRD, qualAusb: users.qualAusb } }).from(appointmentVehicles).innerJoin(vehicles, eq(appointmentVehicles.vehicleId, vehicles.id)).leftJoin(appointmentVehicleMembers, eq(appointmentVehicleMembers.appointmentVehicleId, appointmentVehicles.id)).leftJoin(users, eq(appointmentVehicleMembers.userId, users.id)).where(eq(appointmentVehicles.appointmentId, appointmentId)).orderBy(asc(appointmentVehicles.sortOrder), asc(appointmentVehicles.id));
  const map = new Map<number, ServiceVehicle>();
  for (const row of rows) { const item = map.get(row.assignment.id) ?? { id: row.assignment.id, vehicleId: row.vehicle.id, licensePlate: row.vehicle.licensePlate, type: row.vehicle.type, members: [] }; if (row.member?.userId) item.members.push(row.member); map.set(row.assignment.id, item); }
  return result({ vehicles: Array.from(map.values()), canAdmin: admin(viewer.role) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer(); if (!viewer) return result({ error: "no_viewer" }, 401); if (!admin(viewer.role)) return result({ error: "forbidden" }, 403);
  const appointmentId = Number((await params).id); const body = await request.json(); const action = body.action;
  if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) return result({ error: "Ungültiger Dienst." }, 400);
  const appointment = db.select({state:appointments.state}).from(appointments).where(eq(appointments.id,appointmentId)).get();
  if (!appointment) return result({ error: "Dienst nicht gefunden." }, 404);
  if (appointment.state === "CANCELLED") return result({ error: "Abgesagte Dienste können nicht mehr bearbeitet werden." }, 409);
  if (action === "add") {
    const vehicleId = Number(body.vehicleId); const vehicle = await db.query.vehicles.findFirst({ where: (t, { eq }) => eq(t.id, vehicleId) }); if (!vehicle) return result({ error: "vehicle_not_found" }, 404); if (!vehicle.isActive) return result({ error: "vehicle_out_of_service" }, 409);
    const row = await db.insert(appointmentVehicles).values({ appointmentId, vehicleId, sortOrder: 0 }).onConflictDoNothing().returning({ id: appointmentVehicles.id }); return result({ id: row[0]?.id ?? null });
  }
  if (action === "remove") { await db.delete(appointmentVehicles).where(and(eq(appointmentVehicles.id, Number(body.assignmentId)), eq(appointmentVehicles.appointmentId, appointmentId))); return result({ ok: true }); }
  const assignment = await db.query.appointmentVehicles.findFirst({ where: (t, { and, eq }) => and(eq(t.id, Number(body.assignmentId)), eq(t.appointmentId, appointmentId)) }); if (!assignment) return result({ error: "assignment_not_found" }, 404);
  const userId = Number(body.userId);
  const confirmed = await db.query.appointmentApplications.findFirst({ where: (t, { and, eq }) => and(eq(t.appointmentId, appointmentId), eq(t.userId, userId), eq(t.status, "CONFIRMED")) }); if (!confirmed) return result({ error: "not_confirmed" }, 409);
  if (action === "assign") {
    const vehicle = await db.query.vehicles.findFirst({ where: (t, { eq }) => eq(t.id, assignment.vehicleId) });
    if (!vehicle?.isActive) return result({ error: "vehicle_out_of_service" }, 409);
    db.transaction(tx=>{
      const all = tx.select({ id: appointmentVehicleMembers.id }).from(appointmentVehicleMembers).innerJoin(appointmentVehicles, eq(appointmentVehicleMembers.appointmentVehicleId, appointmentVehicles.id)).where(and(eq(appointmentVehicles.appointmentId, appointmentId), eq(appointmentVehicleMembers.userId, userId))).all();
      if (all.length) tx.delete(appointmentVehicleMembers).where(inArray(appointmentVehicleMembers.id, all.map(x=>x.id))).run();
      tx.insert(appointmentVehicleMembers).values({ appointmentVehicleId: assignment.id, userId }).run();
    },{behavior:"immediate"});return result({ ok: true });
  }
  if (action === "remove-member") { await db.delete(appointmentVehicleMembers).where(and(eq(appointmentVehicleMembers.appointmentVehicleId, assignment.id), eq(appointmentVehicleMembers.userId, userId))); return result({ ok: true }); }
  return result({ error: "unknown_action" }, 400);
}
