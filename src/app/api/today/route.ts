import { NextResponse } from "next/server";
import { and, asc, eq, getTableColumns, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications, appointmentRequirements, appointments, users } from "@/db/schema";
import { allowedAusbQuals, allowedRdQuals } from "@/lib/qual-hierarchy";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

type UserRow = typeof users.$inferSelect;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function startOfNextDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
}

function eligibleWhere(user: UserRow, now: Date) {
  const targeted = eq(appointments.targetUserId, user.id);
  const openAndFuture = and(eq(appointments.state, "OPEN"), gte(appointments.startAt, now));

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

  return and(
    openAndFuture,
    or(
      targeted,
      and(
        or(isNull(appointments.targetUserId), eq(appointments.targetUserId, user.id)),
        or(noRequirements, matchesQual),
      ),
    ),
  );
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const now = new Date();
  const from = startOfDay(now);
  const to = startOfNextDay(now);

  const confirmedToday = await db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      einsatzort: appointments.einsatzort,
    })
    .from(appointmentApplications)
    .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
    .where(
      and(
        eq(appointmentApplications.userId, viewer.id),
        eq(appointmentApplications.status, "CONFIRMED"),
        eq(appointments.state, "OPEN"),
        gte(appointments.startAt, from),
        lt(appointments.startAt, to),
      ),
    )
    .orderBy(asc(appointments.startAt))
    .limit(6);

  const bDay = await db
    .select({ id: users.id, username: users.username, geb: users.geb })
    .from(users)
    .where(inArray(users.role, ["ADMIN", "VERWALTUNG", "PERSONAL"]))
    .orderBy(asc(users.username));

  const todaysBirthdays = bDay
    .filter((u) => {
      if (!u.geb) return false;
      const d = new Date(u.geb);
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
    })
    .slice(0, 6)
    .map((u) => ({ id: u.id, username: u.username }));

  const openToday = await db
    .select(getTableColumns(appointments))
    .from(appointments)
    .leftJoin(
      appointmentApplications,
      and(eq(appointmentApplications.appointmentId, appointments.id), eq(appointmentApplications.userId, viewer.id)),
    )
    .where(
      and(
        eligibleWhere(viewer, now),
        gte(appointments.startAt, from),
        lt(appointments.startAt, to),
        isNull(appointmentApplications.id),
      ),
    )
    .orderBy(asc(appointments.startAt))
    .limit(6);

  return NextResponse.json({
    ok: true,
    today: {
      confirmed: confirmedToday.map((a) => ({
        id: a.id,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt ? a.endAt.toISOString() : null,
        title: a.title,
        einsatzort: a.einsatzort,
      })),
      birthdays: todaysBirthdays,
      requests: openToday.map((a) => ({
        id: a.id,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt ? a.endAt.toISOString() : null,
        title: a.title,
        einsatzort: a.einsatzort,
      })),
    },
  });
}
