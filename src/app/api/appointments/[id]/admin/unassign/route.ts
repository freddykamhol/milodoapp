import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { recomputeAppointmentStaffingStatus } from "@/lib/appointment-staffing";
import { getViewer } from "@/lib/viewer";
import {
  appointmentApplications,
  appointmentSectionMembers,
  appointmentSections,
  notifications,
} from "@/db/schema";

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

  const body = (await request.json().catch(() => null)) as
    | { userId?: unknown; note?: unknown }
    | null;
  const userId = Number(body?.userId);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 });
  const note = String(body?.note ?? "").trim();

  const appointment = await db.query.appointments.findFirst({
    where: (t, { eq }) => eq(t.id, appointmentId),
    columns: { id: true, title: true, startAt: true },
  });

  await db
    .update(appointmentApplications)
    .set({ status: "CANCELLED", adminNote: note, role: "NORMAL", updatedAt: new Date() })
    .where(and(eq(appointmentApplications.appointmentId, appointmentId), eq(appointmentApplications.userId, userId)));

  await recomputeAppointmentStaffingStatus(appointmentId);

  const sectionIds = await db
    .select({ id: appointmentSections.id })
    .from(appointmentSections)
    .where(eq(appointmentSections.appointmentId, appointmentId));

  const ids = sectionIds.map((s) => s.id);
  if (ids.length) {
    await db
      .delete(appointmentSectionMembers)
      .where(and(eq(appointmentSectionMembers.userId, userId), inArray(appointmentSectionMembers.sectionId, ids)));
  }

  if (appointment) {
    const title = "Du wurdest aus einem Termin ausgetragen";
    const when = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(appointment.startAt);
    const bodyText = `${appointment.title}\n${when}${note ? `\n\nBemerkung: ${note}` : ""}`;
    await db.insert(notifications).values({
      scope: "USER",
      userId,
      kind: "SHIFT_CHANGE",
      title,
      body: bodyText,
      href: `/appointments/${appointment.id}`,
    });
  }

  return NextResponse.json({ ok: true });
}
