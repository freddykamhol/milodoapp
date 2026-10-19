import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { appointmentApplications } from "@/db/schema";
import { courseRoute } from "@/lib/course-route";
import { db } from "@/lib/db";
import { recomputeAppointmentStaffingStatus } from "@/lib/appointment-staffing";

export const POST = courseRoute(async (request, { row }) => {
  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = Number(body?.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) return NextResponse.json({ error: "Ungültiges Mitglied." }, { status: 400 });
  const result = await db.update(appointmentApplications).set({ status: "CANCELLED", role: "NORMAL", updatedAt: new Date() }).where(and(eq(appointmentApplications.appointmentId, row.id), eq(appointmentApplications.userId, userId)));
  if (!result.changes) return NextResponse.json({ error: "Diese Person ist nicht eingeteilt." }, { status: 404 });
  await recomputeAppointmentStaffingStatus(row.id);
  return NextResponse.json({ ok: true });
}, "manage");
