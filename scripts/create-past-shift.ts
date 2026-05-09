import "dotenv/config";

import { db } from "../src/lib/db";
import { appointmentApplications, appointments, customers } from "../src/db/schema";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function setLocalTime(d: Date, hour: number, minute = 0) {
  const next = new Date(d);
  next.setHours(hour, minute, 0, 0);
  return next;
}

async function main() {
  const userId = Number(requiredEnv("DEMO_USER_ID"));
  if (!Number.isFinite(userId)) throw new Error("DEMO_USER_ID must be a number");

  const existingCustomer =
    (await db.query.customers.findFirst({
      where: (t, { eq }) => eq(t.name, "BF Dortmund"),
    })) ?? null;

  const insertedCustomer = existingCustomer
    ? null
    : (await db.insert(customers).values({ name: "BF Dortmund" }).returning({ id: customers.id })).at(0) ?? null;

  const customerId = existingCustomer?.id ?? insertedCustomer?.id ?? null;
  if (!customerId) throw new Error("Failed to create/find customer BF Dortmund");

  const now = new Date();
  const day = new Date(now);
  day.setDate(day.getDate() - 2);

  const startAt = setLocalTime(day, 7, 0);
  const endAt = setLocalTime(day, 19, 0);

  const insertedRows = await db
    .insert(appointments)
    .values({
      startAt,
      endAt,
      title: "DEMO - RTW Dienst (12h) • vergangen",
      einsatzort: "BF Dortmund FW 1 Innenstadt",
      customerId,
      bereich: "RD_BOERSE",
      dienstart: "RTW",
      targetUserId: null,
      staffingStatus: "BESETZT",
      state: "OPEN",
    })
    .returning({ id: appointments.id });
  const insertedAppointment = insertedRows.at(0) ?? null;

  if (!insertedAppointment) throw new Error("Failed to insert appointment");

  await db
    .insert(appointmentApplications)
    .values({ appointmentId: insertedAppointment.id, userId, status: "CONFIRMED" })
    .onConflictDoUpdate({
      target: [appointmentApplications.userId, appointmentApplications.appointmentId],
      set: { status: "CONFIRMED", updatedAt: new Date() },
    });

  console.log(`Created past confirmed appointment #${insertedAppointment.id} for user #${userId}`);
  console.log(`Start: ${startAt.toISOString()}`);
  console.log(`End:   ${endAt.toISOString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
