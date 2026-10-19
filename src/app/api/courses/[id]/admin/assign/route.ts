import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { appointmentApplications, users } from "@/db/schema";
import { courseRoute } from "@/lib/course-route";
import { db } from "@/lib/db";
import { recomputeAppointmentStaffingStatus } from "@/lib/appointment-staffing";

export const POST = courseRoute(async (request, { row }) => {
  const body = (await request.json().catch(() => null)) as { userId?: unknown; role?: unknown } | null;
  const userId = Number(body?.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) return NextResponse.json({ error: "Ungültiges Mitglied." }, { status: 400 });
  const member = await db.query.users.findFirst({ where: (table, { eq }) => eq(table.id, userId), columns: { id: true, role: true, locked: true } });
  if (!member || member.role === "KUNDE" || member.locked) return NextResponse.json({ error: "Diese Person kann nicht eingeteilt werden." }, { status: 400 });
  if (row.state === "CANCELLED") return NextResponse.json({ error: "Abgesagte Kurse können nicht besetzt werden." }, { status: 409 });
  const role = body?.role === "EL" ? "EL" : "NORMAL";
  await db.insert(appointmentApplications).values({ appointmentId: row.id, userId, status: "CONFIRMED", role, updatedAt: new Date() }).onConflictDoUpdate({ target: [appointmentApplications.userId, appointmentApplications.appointmentId], set: { status: "CONFIRMED", role, updatedAt: new Date() } });
  await recomputeAppointmentStaffingStatus(row.id);
  return NextResponse.json({ ok: true });
}, "manage");
