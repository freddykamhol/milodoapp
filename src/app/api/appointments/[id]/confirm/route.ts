import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { recomputeAppointmentStaffingStatus } from "@/lib/appointment-staffing";
import { appointmentApplications } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const appointment = await db.query.appointments.findFirst({
    where: (table, { eq }) => eq(table.id, appointmentId),
  });

  if (!appointment) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (appointment.state !== "OPEN") {
    return NextResponse.json({ ok: false, error: "not_open" }, { status: 409 });
  }

  await db
    .insert(appointmentApplications)
    .values({
      appointmentId,
      userId: viewer.id,
      status: "CONFIRMED",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [appointmentApplications.userId, appointmentApplications.appointmentId],
      set: { status: "CONFIRMED", updatedAt: new Date() },
    });

  await recomputeAppointmentStaffingStatus(appointmentId);

  return NextResponse.json({ ok: true });
}
