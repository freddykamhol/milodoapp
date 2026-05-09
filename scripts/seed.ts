import "dotenv/config";

import crypto from "node:crypto";

import { asc, inArray, like } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  appointmentApplications,
  appointmentRequirements,
  appointments,
  customers,
  users,
} from "../src/db/schema";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function hashPassword(plain: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(plain, salt, 32);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function main() {
  const id = Number(requiredEnv("DEMO_USER_ID"));
  if (!Number.isFinite(id)) throw new Error("DEMO_USER_ID must be a number");

  const username = requiredEnv("DEMO_USER_USERNAME");
  const password = requiredEnv("DEMO_USER_PASSWORD");
  const role = requiredEnv("DEMO_USER_ROLE") as "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";

  const demoCustomerId = Number(process.env.DEMO_CUSTOMER_ID ?? "260001");
  if (!Number.isFinite(demoCustomerId)) throw new Error("DEMO_CUSTOMER_ID must be a number");
  const demoCustomerName = process.env.DEMO_CUSTOMER_NAME ?? "Demo Kunde";

  const qualRD = (process.env.DEMO_USER_QUAL_RD || null) as
    | "SAN"
    | "RH"
    | "RS"
    | "RA"
    | "NFS"
    | null;

  const qualAusb = (process.env.DEMO_USER_QUAL_AUSB || null) as "AUSBILDER" | null;

  const passwordHash = hashPassword(password);

  await db
    .insert(users)
    .values({
      id,
      username,
      passwordHash,
      role,
      qualRD,
      qualAusb,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        username,
        passwordHash,
        role,
        qualRD,
        qualAusb,
      },
    });

  await db
    .insert(customers)
    .values({
      id: demoCustomerId,
      name: demoCustomerName,
      accountUserId: id,
    })
    .onConflictDoUpdate({
      target: customers.id,
      set: {
        name: demoCustomerName,
        accountUserId: id,
        updatedAt: new Date(),
      },
    });

  const shouldSeedAppointments = (process.env.DEMO_SEED_APPOINTMENTS ?? "1") !== "0";

  if (shouldSeedAppointments) {
    await seedDemoAppointments({ userId: id, customerId: demoCustomerId });
  }

  console.log(
    `Seeded demo user #${id} (${username}) qualRD=${qualRD ?? "null"} qualAusb=${qualAusb ?? "null"} appointments=${shouldSeedAppointments ? "yes" : "no"}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function nextShiftStart(now: Date) {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  // nächster Slot: 07:00 oder 19:00
  const hour = d.getHours();
  if (hour < 7) d.setHours(7);
  else if (hour < 19) d.setHours(19);
  else {
    d.setDate(d.getDate() + 1);
    d.setHours(7);
  }
  return d;
}

async function seedDemoAppointments({ userId, customerId }: { userId: number; customerId: number }) {
  const demoPrefix = "DEMO - ";

  const existing = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(like(appointments.title, `${demoPrefix}%`));

  const existingIds = existing.map((row) => row.id);
  if (existingIds.length) {
    await db.delete(appointmentApplications).where(inArray(appointmentApplications.appointmentId, existingIds));
    await db.delete(appointmentRequirements).where(inArray(appointmentRequirements.appointmentId, existingIds));
    await db.delete(appointments).where(inArray(appointments.id, existingIds));
  }

  const customerExists =
    (await db.query.customers.findFirst({
      where: (table, { eq }) => eq(table.id, customerId),
      columns: { id: true },
    })) ?? null;
  if (!customerExists) {
    throw new Error(`DEMO_CUSTOMER_ID=${customerId} not found. Run seed main first.`);
  }

  const wachen = [
    "BF Dortmund FW 1 Innenstadt",
    "BF Dortmund FW 2 Eving",
    "BF Dortmund FW 3 Neuasseln",
    "BF Dortmund FW 4 Hörde",
    "BF Dortmund FW 5 Marten",
    "BF Dortmund FW 6 Mengede",
    "BF Dortmund FW 7 Aplerbeck",
    "BF Dortmund FW 8 Scharnhorst",
  ] as const;

  const dienstTypen = ["RTW", "NEF", "KTW"] as const;
  const dienstDauern = [12, 24] as const;

  const base = nextShiftStart(new Date());
  const values: Array<{
    appointment: typeof appointments.$inferInsert;
    requirements: Array<Omit<typeof appointmentRequirements.$inferInsert, "appointmentId">>;
  }> = Array.from({ length: 20 }).map((_, idx) => {
    const typ = dienstTypen[idx % dienstTypen.length];
    const dauer = dienstDauern[idx % dienstDauern.length];

    const startAt = addHours(base, idx * 12);
    const endAt = addHours(startAt, dauer);

    const appointment: typeof appointments.$inferInsert = {
      startAt,
      endAt,
      title: `${demoPrefix}${typ} Dienst (${dauer}h)`,
      einsatzort: wachen[idx % wachen.length],
      customerId,
      bereich: "RD_BOERSE",
      dienstart: typ,
      targetUserId: null,
      staffingStatus: "UNBESETZT",
      state: "OPEN",
    };

    const requirements: Array<Omit<typeof appointmentRequirements.$inferInsert, "appointmentId">> = [];

    if (typ === "RTW") {
      requirements.push({ kind: "QUAL_RD", value: "RS", minCount: 1 });
      requirements.push({ kind: "QUAL_RD", value: "NFS", minCount: 1 });
    } else if (typ === "NEF") {
      requirements.push({ kind: "QUAL_RD", value: "NFS", minCount: 1 });
    } else if (typ === "KTW") {
      requirements.push({ kind: "QUAL_RD", value: "RS", minCount: 1 });
    }

    if (idx % 7 === 0) {
      requirements.push({ kind: "QUAL_AUSB", value: "AUSBILDER", minCount: 2 });
    }

    return { appointment, requirements };
  });

  const inserted = await db
    .insert(appointments)
    .values(values.map((v) => v.appointment))
    .returning({ id: appointments.id });

  const insertedIds = inserted.map((row) => row.id);
  if (insertedIds.length !== 20) {
    throw new Error(`Expected 20 appointments inserted, got ${insertedIds.length}`);
  }

  const requirementsToInsert: Array<typeof appointmentRequirements.$inferInsert> = [];
  for (let idx = 0; idx < insertedIds.length; idx += 1) {
    const appointmentId = insertedIds[idx];
    const r = values[idx]?.requirements ?? [];
    for (const req of r) {
      requirementsToInsert.push({ ...req, appointmentId });
    }
  }

  if (requirementsToInsert.length) {
    await db.insert(appointmentRequirements).values(requirementsToInsert).onConflictDoNothing();
  }

  // 3 zugesagt (CONFIRMED): die 3 frühesten
  const earliest = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(like(appointments.title, `${demoPrefix}%`))
    .orderBy(asc(appointments.startAt))
    .limit(3);

  const earliestIds = earliest.map((row) => row.id);
  if (!earliestIds.length) return;

  await db
    .insert(appointmentApplications)
    .values(
      earliestIds.map((appointmentId) => ({
        appointmentId,
        userId,
        status: "CONFIRMED" as const,
      })),
    )
    .onConflictDoNothing();
}
