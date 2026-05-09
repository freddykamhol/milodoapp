import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications, appointmentRequirements, appointments } from "@/db/schema";

export type StaffingStatus = "BESETZT" | "UNBESETZT" | "UNTERBESETZT";

export async function recomputeAppointmentStaffingStatus(appointmentId: number) {
  const [{ requiredTotal }, { confirmedCount }] = await Promise.all([
    db
      .select({ requiredTotal: sql<number>`coalesce(sum(${appointmentRequirements.minCount}), 0)`.as("requiredTotal") })
      .from(appointmentRequirements)
      .where(eq(appointmentRequirements.appointmentId, appointmentId))
      .then((rows) => rows[0] ?? { requiredTotal: 0 }),
    db
      .select({ confirmedCount: sql<number>`count(*)`.as("confirmedCount") })
      .from(appointmentApplications)
      .where(
        and(eq(appointmentApplications.appointmentId, appointmentId), eq(appointmentApplications.status, "CONFIRMED")),
      )
      .then((rows) => rows[0] ?? { confirmedCount: 0 }),
  ]);

  const required = Math.max(0, Number(requiredTotal) || 0);
  const confirmed = Math.max(0, Number(confirmedCount) || 0);

  const staffingStatus: StaffingStatus =
    required <= 0
      ? confirmed > 0
        ? "BESETZT"
        : "UNBESETZT"
      : confirmed <= 0
        ? "UNBESETZT"
        : confirmed >= required
          ? "BESETZT"
          : "UNTERBESETZT";

  await db
    .update(appointments)
    .set({ staffingStatus, updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));

  return { staffingStatus, required, confirmed };
}
