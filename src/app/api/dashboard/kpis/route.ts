import { NextResponse } from "next/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications, appointmentRequirements, appointments, users } from "@/db/schema";
import { allowedAusbQuals, allowedRdQuals } from "@/lib/qual-hierarchy";
import { getViewer as getViewerFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";

type UserRow = typeof users.$inferSelect;

async function getViewer(): Promise<UserRow | null> {
  return (await getViewerFromRequest()) ?? null;
}

function eligibleWhere(user: UserRow) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const targeted = eq(appointments.targetUserId, user.id);
  const openAndFuture = and(eq(appointments.state, "OPEN"), gte(appointments.startAt, cutoff));

  if (user.role === "ADMIN" || user.role === "VERWALTUNG") return openAndFuture;

  const noRequirements = sql`not exists(select 1 from ${appointmentRequirements} where ${appointmentRequirements.appointmentId} = ${appointments.id})`;

  const rdValues = allowedRdQuals(user.qualRD);
  const ausbValues = allowedAusbQuals({ qualRD: user.qualRD, qualAusb: user.qualAusb });

  const matchesQual =
    user.qualRD || user.qualAusb
      ? sql`exists(
          select 1
          from ${appointmentRequirements}
          where ${appointmentRequirements.appointmentId} = ${appointments.id}
            and (
              ${
                rdValues.length
                  ? sql`(${appointmentRequirements.kind} = 'QUAL_RD' and ${appointmentRequirements.value} in (${sql.join(
                      rdValues.map((v) => sql`${v}`),
                      sql`, `,
                    )}))`
                  : sql`0`
              }
              or
              ${
                ausbValues.length
                  ? sql`(${appointmentRequirements.kind} = 'QUAL_AUSB' and ${appointmentRequirements.value} in (${sql.join(
                      ausbValues.map((v) => sql`${v}`),
                      sql`, `,
                    )}))`
                  : sql`0`
              }
            )
        )`
      : sql`0`;

  return and(openAndFuture, sql`(${targeted} or ${noRequirements} or ${matchesQual})`);
}

async function getKpis(user: UserRow) {
  const reportedOrConfirmed = await db
    .select({
      status: appointmentApplications.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(appointmentApplications)
    .where(
      and(
        eq(appointmentApplications.userId, user.id),
        inArray(appointmentApplications.status, ["REPORTED", "CONFIRMED"]),
      ),
    )
    .groupBy(appointmentApplications.status);

  const reported = reportedOrConfirmed.find((r) => r.status === "REPORTED")?.count ?? 0;
  const confirmed = reportedOrConfirmed.find((r) => r.status === "CONFIRMED")?.count ?? 0;

  const openCount = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(appointments)
    .where(eligibleWhere(user))
    .limit(1);

  return { open: openCount.at(0)?.count ?? 0, reported, confirmed };
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const kpis = await getKpis(viewer);
  return NextResponse.json({ ok: true, kpis });
}
