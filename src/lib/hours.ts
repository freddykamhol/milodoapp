import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications, appointments, customers, hourEntries, timesheetEvents, timesheetMonths, users } from "@/db/schema";

function startOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function startOfNextMonth(year: number, month: number) {
  return month === 12 ? new Date(year + 1, 0, 1, 0, 0, 0, 0) : new Date(year, month, 1, 0, 0, 0, 0);
}

export type HoursMonthEntry = {
  id: number;
  appointmentId: number;
  actualStartAt: string;
  actualEndAt: string;
  title: string;
  einsatzort: string;
  customerName: string | null;
  dienstart: string | null;
};

export type HoursMonthData = {
  month: { year: number; month: number; status: "OPEN" | "CLOSED" };
  reopen:
    | {
        note: string;
        actorName: string;
        createdAt: string;
      }
    | null;
  totalMinutes: number;
  entries: HoursMonthEntry[];
};

export async function getHoursMonthData({
  userId,
  year,
  month,
  now = new Date(),
}: {
  userId: number;
  year: number;
  month: number;
  now?: Date;
}): Promise<HoursMonthData> {
  if (month < 1 || month > 12) {
    throw new Error("invalid_month");
  }

  const from = startOfMonth(year, month);
  const to = startOfNextMonth(year, month);

  await db
    .insert(timesheetMonths)
    .values({ userId, year, month })
    .onConflictDoNothing();

  const monthRow = await db.query.timesheetMonths.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.year, year), eq(t.month, month)),
  });

  const lastEvent =
    monthRow?.status === "OPEN"
      ? (await db
          .select({
            createdAt: timesheetEvents.createdAt,
            action: timesheetEvents.action,
            note: timesheetEvents.note,
            actorName: users.username,
          })
          .from(timesheetEvents)
          .innerJoin(users, eq(timesheetEvents.actorUserId, users.id))
          .where(and(eq(timesheetEvents.userId, userId), eq(timesheetEvents.year, year), eq(timesheetEvents.month, month)))
          .orderBy(desc(timesheetEvents.createdAt), desc(timesheetEvents.id))
          .limit(1)
        ).at(0) ?? null
      : null;

  const confirmedAppointments = await db
    .select({
      appointmentId: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
    })
    .from(appointmentApplications)
    .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
    .where(
      and(
        eq(appointmentApplications.userId, userId),
        eq(appointmentApplications.status, "CONFIRMED"),
        gte(appointments.startAt, from),
        lt(appointments.startAt, to),
        lt(appointments.startAt, now),
      ),
    );

  for (const a of confirmedAppointments) {
    const endAt = a.endAt ?? new Date(a.startAt.getTime() + 12 * 60 * 60 * 1000);
    await db
      .insert(hourEntries)
      .values({
        userId,
        appointmentId: a.appointmentId,
        actualStartAt: a.startAt,
        actualEndAt: endAt,
      })
      .onConflictDoNothing();
  }

  const rows = await db
    .select({
      id: hourEntries.id,
      appointmentId: hourEntries.appointmentId,
      actualStartAt: hourEntries.actualStartAt,
      actualEndAt: hourEntries.actualEndAt,
      title: appointments.title,
      einsatzort: appointments.einsatzort,
      customerName: customers.name,
      dienstart: appointments.dienstart,
    })
    .from(hourEntries)
    .innerJoin(appointments, eq(hourEntries.appointmentId, appointments.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(
      and(
        eq(hourEntries.userId, userId),
        gte(hourEntries.actualStartAt, from),
        lt(hourEntries.actualStartAt, to),
      ),
    )
    .orderBy(asc(hourEntries.actualStartAt));

  const totalMinutes = rows.reduce((acc, r) => {
    const minutes = Math.max(0, Math.round((r.actualEndAt.getTime() - r.actualStartAt.getTime()) / 60000));
    return acc + minutes;
  }, 0);

  return {
    month: { year, month, status: monthRow?.status ?? "OPEN" },
    reopen:
      monthRow?.status === "OPEN" && lastEvent?.action === "REOPEN" && lastEvent.note?.trim()
        ? {
            note: lastEvent.note.trim(),
            actorName: lastEvent.actorName,
            createdAt: new Date(lastEvent.createdAt).toISOString(),
          }
        : null,
    totalMinutes,
    entries: rows.map((r) => ({
      id: r.id,
      appointmentId: r.appointmentId,
      actualStartAt: r.actualStartAt.toISOString(),
      actualEndAt: r.actualEndAt.toISOString(),
      title: r.title,
      einsatzort: r.einsatzort,
      customerName: r.customerName ?? null,
      dienstart: r.dienstart ?? null,
    })),
  };
}
