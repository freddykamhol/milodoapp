import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { appointmentApplications, appointmentVehicleMembers, appointmentVehicles, appointments, customers, users, vehicles } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { buildAppointmentDutyPlan } from "@/lib/appointment-duty-plan-pdf";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new NextResponse("unauthorized", { status: 401 });
  const appointmentId = Number((await params).id);
  if (!Number.isSafeInteger(appointmentId)) return new NextResponse("invalid", { status: 400 });

  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    columns: { id: true, title: true, startAt: true, endAt: true, einsatzort: true, customerId: true },
  });
  if (!appointment) return new NextResponse("not_found", { status: 404 });
  const manager = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const ownAssignment = await db.query.appointmentApplications.findFirst({
    where: and(eq(appointmentApplications.appointmentId, appointmentId), eq(appointmentApplications.userId, viewer.id), eq(appointmentApplications.status, "CONFIRMED")),
    columns: { id: true },
  });
  if (!manager && !ownAssignment) return new NextResponse("forbidden", { status: 403 });

  const [customer, staffRows, vehicleRows] = await Promise.all([
    db.query.customers.findFirst({ where: eq(customers.id, appointment.customerId), columns: { name: true } }),
    db.select({ firstName: users.firstName, lastName: users.lastName, username: users.username, qualRD: users.qualRD, qualAusb: users.qualAusb, telefon: users.telefon, role: appointmentApplications.role })
      .from(appointmentApplications)
      .innerJoin(users, eq(appointmentApplications.userId, users.id))
      .where(and(eq(appointmentApplications.appointmentId, appointmentId), eq(appointmentApplications.status, "CONFIRMED")))
      .orderBy(asc(users.lastName), asc(users.firstName), asc(users.username)),
    db.select({ licensePlate: vehicles.licensePlate, type: vehicles.type, firstName: users.firstName, lastName: users.lastName, username: users.username, qualRD: users.qualRD, qualAusb: users.qualAusb, telefon: users.telefon })
      .from(appointmentVehicles)
      .innerJoin(vehicles, eq(appointmentVehicles.vehicleId, vehicles.id))
      .leftJoin(appointmentVehicleMembers, eq(appointmentVehicleMembers.appointmentVehicleId, appointmentVehicles.id))
      .leftJoin(users, eq(appointmentVehicleMembers.userId, users.id))
      .where(eq(appointmentVehicles.appointmentId, appointmentId))
      .orderBy(asc(appointmentVehicles.sortOrder), asc(appointmentVehicles.id), asc(users.lastName), asc(users.firstName)),
  ]);

  const staff = staffRows.map((row) => ({ ...row, role: String(row.role) }));
  const vehicleMap = new Map<string, { licensePlate: string; type: string; members: typeof staff }>();
  for (const row of vehicleRows) {
    const key = `${row.licensePlate}|${row.type}`;
    const vehicle = vehicleMap.get(key) ?? { licensePlate: row.licensePlate, type: row.type, members: [] };
    if (row.username) vehicle.members.push({ firstName: row.firstName ?? "", lastName: row.lastName ?? "", username: row.username, qualRD: row.qualRD, qualAusb: row.qualAusb, telefon: row.telefon, role: "NORMAL" });
    vehicleMap.set(key, vehicle);
  }

  const bytes = await buildAppointmentDutyPlan({
    ...appointment,
    customerName: customer?.name ?? "-",
    staff,
    vehicles: Array.from(vehicleMap.values()),
  });
  return new Response(bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="Dienstplan-${appointment.id}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
