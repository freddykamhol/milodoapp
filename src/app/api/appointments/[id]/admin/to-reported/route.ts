import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { recomputeAppointmentStaffingStatus } from "@/lib/appointment-staffing";
import { appointmentApplications, notifications } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const appointment = await db.query.appointments.findFirst({ where: (t, { eq }) => eq(t.id, appointmentId) });
  if (!appointment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | { userId?: unknown }
    | null;
  const userId = Number(body?.userId);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 });

  await db
    .update(appointmentApplications)
    .set({ status: "REPORTED", adminNote: "", role: "NORMAL", updatedAt: new Date() })
    .where(and(eq(appointmentApplications.appointmentId, appointmentId), eq(appointmentApplications.userId, userId)));

  await recomputeAppointmentStaffingStatus(appointmentId);

  const title = "Deine Einteilung wurde zurückgesetzt";
  const when = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(appointment.startAt);
  await db.insert(notifications).values({
    scope: "USER",
    userId,
    kind: "SHIFT_CHANGE",
    title,
    body: `${appointment.title}\n${when}\n\nStatus: GEMELDET`,
    href: `/appointments/${appointment.id}`,
  });

  return NextResponse.json({ ok: true });
}
