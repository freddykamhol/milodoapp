import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";

import { StatsGridClient } from "./_components/stats-grid-client";

import { db } from "@/lib/db";
import {
  appointmentApplications,
  appointments,
  customers,
  documents,
  hourEntries,
  timesheetMonths,
  users,
} from "@/db/schema";
import { getViewer } from "@/lib/viewer";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
}

export default async function StatsSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) notFound();

  const now = new Date();
  const from30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const futureCutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const currentMonthStart = startOfMonth(now);
  const lastMonthStart = addMonths(currentMonthStart, -1);
  const nextMonthStart = addMonths(currentMonthStart, 1);

  const openFutureWhere = and(eq(appointments.state, "OPEN"), gt(appointments.startAt, now));
  const next90Where = and(eq(appointments.state, "OPEN"), gte(appointments.startAt, now), lt(appointments.startAt, futureCutoff));

  const [openFutureCounts, next90ByType, appsNext90, membersCountRow, customersCountRow, documentsCountRow] =
    await Promise.all([
      db
        .select({
          staffingStatus: appointments.staffingStatus,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(appointments)
        .where(openFutureWhere)
        .groupBy(appointments.staffingStatus),

      db
        .select({
          dienstart: appointments.dienstart,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(appointments)
        .where(next90Where)
        .groupBy(appointments.dienstart)
        .orderBy(desc(sql`count(*)`)),

      db
        .select({
          status: appointmentApplications.status,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(appointmentApplications)
        .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
        .where(and(next90Where, inArray(appointmentApplications.status, ["REPORTED", "CONFIRMED"])))
        .groupBy(appointmentApplications.status),

      db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(users)
        .where(inArray(users.role, ["ADMIN", "VERWALTUNG", "PERSONAL"]))
        .limit(1),

      db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(customers)
        .limit(1),

      db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(documents)
        .limit(1),
    ]);

  const openFutureTotal =
    openFutureCounts.reduce((acc, r) => acc + (r.count ?? 0), 0) ?? 0;
  const openBesetzt = openFutureCounts.find((r) => r.staffingStatus === "BESETZT")?.count ?? 0;
  const openUnterbesetzt = openFutureCounts.find((r) => r.staffingStatus === "UNTERBESETZT")?.count ?? 0;
  const openUnbesetzt = openFutureCounts.find((r) => r.staffingStatus === "UNBESETZT")?.count ?? 0;

  const occupancy = openFutureTotal ? (openBesetzt / openFutureTotal) * 100 : 0;

  const reportedNext90 = appsNext90.find((r) => r.status === "REPORTED")?.count ?? 0;
  const confirmedNext90 = appsNext90.find((r) => r.status === "CONFIRMED")?.count ?? 0;

  const membersCount = membersCountRow.at(0)?.count ?? 0;
  const customersCount = customersCountRow.at(0)?.count ?? 0;
  const documentsCount = documentsCountRow.at(0)?.count ?? 0;

  const [hoursThisMonthRow, hoursLastMonthRow, timesheetsThisMonth, hoursByMonthRows, next7DaysRows, topCustomersRows] =
    await Promise.all([
      db
        .select({
          minutes: sql<number>`coalesce(sum((${hourEntries.actualEndAt} - ${hourEntries.actualStartAt}) / 60000), 0)`.as(
            "minutes",
          ),
        })
        .from(hourEntries)
        .where(and(gte(hourEntries.actualStartAt, currentMonthStart), lt(hourEntries.actualStartAt, nextMonthStart)))
        .limit(1),

      db
        .select({
          minutes: sql<number>`coalesce(sum((${hourEntries.actualEndAt} - ${hourEntries.actualStartAt}) / 60000), 0)`.as(
            "minutes",
          ),
        })
        .from(hourEntries)
        .where(and(gte(hourEntries.actualStartAt, lastMonthStart), lt(hourEntries.actualStartAt, currentMonthStart)))
        .limit(1),

      db
        .select({
          status: timesheetMonths.status,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(timesheetMonths)
        .where(and(eq(timesheetMonths.year, now.getFullYear()), eq(timesheetMonths.month, now.getMonth() + 1)))
        .groupBy(timesheetMonths.status),

      db
        .select({
          ym: sql<number>`cast(strftime('%Y', datetime(${hourEntries.actualStartAt} / 1000, 'unixepoch')) as int) * 100 + cast(strftime('%m', datetime(${hourEntries.actualStartAt} / 1000, 'unixepoch')) as int)`.as(
            "ym",
          ),
          minutes: sql<number>`coalesce(sum((${hourEntries.actualEndAt} - ${hourEntries.actualStartAt}) / 60000), 0)`.as(
            "minutes",
          ),
        })
        .from(hourEntries)
        .where(gte(hourEntries.actualStartAt, addMonths(currentMonthStart, -6)))
        .groupBy(sql`ym`)
        .orderBy(asc(sql`ym`)),

      // next 7 days distribution
      db
        .select({
          day: sql<string>`strftime('%Y-%m-%d', datetime(${appointments.startAt} / 1000, 'unixepoch'))`.as("day"),
          count: sql<number>`count(*)`.as("count"),
        })
        .from(appointments)
        .where(and(eq(appointments.state, "OPEN"), gte(appointments.startAt, now), lt(appointments.startAt, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))))
        .groupBy(sql`day`)
        .orderBy(asc(sql`day`)),

      // top customers last 30 days (all appointments)
      db
        .select({
          name: customers.name,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(appointments)
        .innerJoin(customers, eq(appointments.customerId, customers.id))
        .where(and(gte(appointments.startAt, from30), lt(appointments.startAt, now)))
        .groupBy(customers.name)
        .orderBy(desc(sql`count(*)`))
        .limit(8),
    ]);

  const minutesThisMonth = hoursThisMonthRow.at(0)?.minutes ?? 0;
  const minutesLastMonth = hoursLastMonthRow.at(0)?.minutes ?? 0;

  const closedThisMonth = timesheetsThisMonth.find((r) => r.status === "CLOSED")?.count ?? 0;
  const openThisMonth = timesheetsThisMonth.find((r) => r.status === "OPEN")?.count ?? 0;
  const timesheetCompletion = membersCount ? (closedThisMonth / membersCount) * 100 : 0;

  const minutesByMonth = new Map<number, number>(hoursByMonthRows.map((r) => [r.ym, r.minutes] as const));
  const last6: Array<{ year: number; month: number; minutes: number }> = Array.from({ length: 6 }).map((_, idx) => {
    const d = addMonths(currentMonthStart, -5 + idx);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const ym = y * 100 + m;
    return { year: y, month: m, minutes: minutesByMonth.get(ym) ?? 0 };
  });

  return (
    <StatsGridClient
      data={{
        kpis: {
          openFutureTotal,
          occupancyPercent: occupancy,
          confirmedNext90,
          reportedNext90,
          minutesThisMonth,
          minutesLastMonth,
        },
        occupancy: { openBesetzt, openUnterbesetzt, openUnbesetzt },
        next90ByType: next90ByType.map((r) => ({ dienstart: r.dienstart ?? null, count: r.count ?? 0 })),
        timesheets: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          closedThisMonth,
          openThisMonth,
          membersCount,
          completionPercent: timesheetCompletion,
        },
        last6,
        next7Days: next7DaysRows.map((r) => ({ day: r.day, count: r.count ?? 0 })),
        topCustomers: topCustomersRows.map((r) => ({ name: r.name, count: r.count ?? 0 })),
        master: { membersCount, customersCount, documentsCount },
      }}
    />
  );
}
