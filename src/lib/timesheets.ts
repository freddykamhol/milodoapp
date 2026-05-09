import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications, appointments, timesheetMonths } from "@/db/schema";

export type TimesheetMonthSummary = {
  year: number;
  month: number; // 1-12
  status: "OPEN" | "CLOSED";
  hasData: boolean;
};

export type TimesheetYearSummary = {
  year: number;
  months: TimesheetMonthSummary[];
};

function currentYearMonth(now: Date) {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export async function getTimesheetIndex({
  userId,
  now = new Date(),
}: {
  userId: number;
  now?: Date;
}): Promise<{ years: TimesheetYearSummary[] }> {
  const { year: currentYear, month: currentMonth } = currentYearMonth(now);

  const monthRows = await db
    .select({ year: timesheetMonths.year, month: timesheetMonths.month, status: timesheetMonths.status })
    .from(timesheetMonths)
    .where(eq(timesheetMonths.userId, userId));

  const yearExpr = sql<number>`cast(strftime('%Y', datetime(${appointments.startAt} / 1000, 'unixepoch')) as int)`;
  const monthExpr = sql<number>`cast(strftime('%m', datetime(${appointments.startAt} / 1000, 'unixepoch')) as int)`;

  const appointmentMonths = await db
    .select({
      year: yearExpr.as("year"),
      month: monthExpr.as("month"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(appointmentApplications)
    .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
    .where(
      and(
        eq(appointmentApplications.userId, userId),
        eq(appointmentApplications.status, "CONFIRMED"),
        lt(appointments.startAt, now),
      ),
    )
    .groupBy(yearExpr, monthExpr);

  const yearsSet = new Set<number>([currentYear]);
  for (const r of monthRows) yearsSet.add(r.year);
  for (const r of appointmentMonths) yearsSet.add(r.year);

  const statusByYm = new Map<string, "OPEN" | "CLOSED">(
    monthRows.map((r) => [`${r.year}-${r.month}`, r.status] as const),
  );
  const hasDataByYm = new Map<string, boolean>(
    appointmentMonths.map((r) => [`${r.year}-${r.month}`, (r.count ?? 0) > 0] as const),
  );

  const years = Array.from(yearsSet).sort((a, b) => b - a);

  const result: TimesheetYearSummary[] = [];
  for (const y of years) {
    const monthsSet = new Set<number>();

    if (y === currentYear) {
      for (let m = 1; m <= currentMonth; m += 1) monthsSet.add(m);
    }

    for (const r of monthRows) if (r.year === y) monthsSet.add(r.month);
    for (const r of appointmentMonths) if (r.year === y) monthsSet.add(r.month);

    const months = Array.from(monthsSet)
      .sort((a, b) => a - b)
      .map((m) => {
        const key = `${y}-${m}`;
        return {
          year: y,
          month: m,
          status: statusByYm.get(key) ?? "OPEN",
          hasData: hasDataByYm.get(key) ?? false,
        } satisfies TimesheetMonthSummary;
      });

    if (months.length === 0) continue;
    result.push({ year: y, months });
  }

  // Ensure current year exists (even if no data yet) for admin browsing.
  if (!result.find((r) => r.year === currentYear)) {
    result.unshift({
      year: currentYear,
      months: Array.from({ length: currentMonth }).map((_, idx) => ({
        year: currentYear,
        month: idx + 1,
        status: statusByYm.get(`${currentYear}-${idx + 1}`) ?? "OPEN",
        hasData: hasDataByYm.get(`${currentYear}-${idx + 1}`) ?? false,
      })),
    });
  }

  // keep current year on top, then descending
  result.sort((a, b) => {
    if (a.year === currentYear && b.year !== currentYear) return -1;
    if (b.year === currentYear && a.year !== currentYear) return 1;
    return b.year - a.year;
  });

  return { years: result };
}

