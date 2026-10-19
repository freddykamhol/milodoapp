import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications, appointmentRequirements, appointments, appointmentSections, appointmentSectionMembers, appointmentVehicles, appointmentVehicleMembers } from "@/db/schema";

export function setApplicationState(appointmentId: number, userId: number, status: "REPORTED" | "CANCELLED", note = "") {
  return db.transaction(tx => {
    const application = tx.select().from(appointmentApplications).where(and(eq(appointmentApplications.appointmentId, appointmentId), eq(appointmentApplications.userId, userId))).get();
    if (!application) return null;
    tx.update(appointmentApplications).set({ status, adminNote: note, role: "NORMAL", updatedAt: new Date() }).where(eq(appointmentApplications.id, application.id)).run();
    const sections = tx.select({ id: appointmentSections.id }).from(appointmentSections).where(eq(appointmentSections.appointmentId, appointmentId)).all().map(row => row.id);
    const vehicleAssignments = tx.select({ id: appointmentVehicles.id }).from(appointmentVehicles).where(eq(appointmentVehicles.appointmentId, appointmentId)).all().map(row => row.id);
    if (sections.length) tx.delete(appointmentSectionMembers).where(and(eq(appointmentSectionMembers.userId, userId), inArray(appointmentSectionMembers.sectionId, sections))).run();
    if (vehicleAssignments.length) tx.delete(appointmentVehicleMembers).where(and(eq(appointmentVehicleMembers.userId, userId), inArray(appointmentVehicleMembers.appointmentVehicleId, vehicleAssignments))).run();
    return application;
  });
}

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
