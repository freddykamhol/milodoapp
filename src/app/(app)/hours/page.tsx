import { AppShell } from "../_components/app-shell";
import { Card } from "../_components/ui";
import { HoursClient } from "./_components/hours-client";

import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { getHoursMonthData } from "@/lib/hours";
import { timesheetMonths, users } from "@/db/schema";
import { getTimesheetIndex } from "@/lib/timesheets";
import { getViewer } from "@/lib/viewer";

export default async function HoursPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const now = new Date();
  const sp = (await searchParams) ?? {};
  const rawYear = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  const rawMonth = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const parsedYear = rawYear ? Number(rawYear) : NaN;
  const parsedMonth = rawMonth ? Number(rawMonth) : NaN;
  const year = Number.isFinite(parsedYear) ? parsedYear : now.getFullYear();
  const month =
    Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1;

  const canSeeMembers = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";

  const data = await getHoursMonthData({ userId: viewer.id, year, month, now });
  const timesheets = canSeeMembers ? await getTimesheetIndex({ userId: viewer.id, now }) : null;
  const members = canSeeMembers
    ? await db
        .select({ id: users.id, username: users.username, role: users.role })
        .from(users)
        .where(inArray(users.role, ["ADMIN", "VERWALTUNG", "PERSONAL"]))
        .orderBy(users.username)
    : [];

  const memberIds = members.map((m) => m.id);

  const currentMonthRows = canSeeMembers
    ? await db
        .select({ userId: timesheetMonths.userId, status: timesheetMonths.status })
        .from(timesheetMonths)
        .where(
          memberIds.length
            ? and(eq(timesheetMonths.year, year), eq(timesheetMonths.month, month), inArray(timesheetMonths.userId, memberIds))
            : and(eq(timesheetMonths.year, year), eq(timesheetMonths.month, month)),
        )
    : [];

  const lastClosedRows = canSeeMembers
    ? memberIds.length
      ? await db
        .select({
          userId: timesheetMonths.userId,
          maxYm: sql<number>`max(${timesheetMonths.year} * 100 + ${timesheetMonths.month})`.as("maxYm"),
        })
        .from(timesheetMonths)
        .where(and(inArray(timesheetMonths.userId, memberIds), eq(timesheetMonths.status, "CLOSED")))
        .groupBy(timesheetMonths.userId)
      : []
    : [];

  const currentMonthByUser = new Map(currentMonthRows.map((r) => [r.userId, r.status] as const));
  const lastClosedByUser = new Map(lastClosedRows.map((r) => [r.userId, r.maxYm] as const));

  const memberSummaries = members.map((m) => {
    const status = currentMonthByUser.get(m.id) ?? "OPEN";
    const isClosed = status === "CLOSED";

    const maxYm = lastClosedByUser.get(m.id) ?? null;
    const label =
      typeof maxYm === "number" && Number.isFinite(maxYm)
        ? `${String(maxYm % 100).padStart(2, "0")}/${String(Math.floor(maxYm / 100) % 100).padStart(2, "0")}`
        : "—";

    return { ...m, isClosedCurrentMonth: isClosed, lastClosedLabel: label };
  });

  return (
    <AppShell title="Stunden" subtitle="Monatsweise Übersicht über deine vergangenen Dienste.">
      <HoursClient
        viewer={{ id: viewer.id, role: viewer.role, username: viewer.username }}
        initialYear={data.month.year}
        initialMonth={data.month.month}
        initialStatus={data.month.status}
        initialReopen={data.reopen}
        initialTotalMinutes={data.totalMinutes}
        initialEntries={data.entries}
        initialForUserId={viewer.id}
        initialForUserName={viewer.username}
        members={memberSummaries}
        initialTimesheets={timesheets?.years ?? []}
      />
    </AppShell>
  );
}
