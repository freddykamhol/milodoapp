import { NextResponse } from "next/server";
import { and, asc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  appointmentApplications,
  appointmentRequirements,
  appointments,
  customers,
  users,
} from "@/db/schema";
import { allowedAusbQuals, allowedRdQuals } from "@/lib/qual-hierarchy";
import { getViewer } from "@/lib/viewer";

type FilterKey = "all" | "open" | "staffed" | "reported" | "confirmed" | "cancelled";
type RangeKey = "1m" | "3m" | "12m" | "future";

function parseCursor(value: string | null): { startAt: Date; id: number } | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const obj = JSON.parse(decoded) as { s: number; id: number };
    if (!Number.isFinite(obj?.s) || !Number.isFinite(obj?.id)) return null;
    return { startAt: new Date(obj.s), id: obj.id };
  } catch {
    return null;
  }
}

function makeCursor(row: { startAt: Date; id: number }) {
  const payload = JSON.stringify({ s: row.startAt.getTime(), id: row.id });
  return Buffer.from(payload, "utf8").toString("base64url");
}

function parseFilter(value: string | null): FilterKey {
  if (value === "all" || value === "staffed" || value === "reported" || value === "confirmed" || value === "cancelled") {
    return value;
  }
  return "open";
}

function parseRange(value: string | null): RangeKey {
  if (value === "1m" || value === "3m" || value === "12m" || value === "future") return value;
  return "future";
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function getCurrentUser() {
  return (await getViewer()) ?? null;
}

function eligibleWhere(user: typeof users.$inferSelect) {
  const targeted = eq(appointments.targetUserId, user.id);
  const openAndFuture = and(eq(appointments.state, "OPEN"), gt(appointments.startAt, new Date()));

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter = parseFilter(url.searchParams.get("filter"));
  const range = parseRange(url.searchParams.get("range"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10"), 1), 25);
  const cursor = parseCursor(url.searchParams.get("cursor"));

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ events: [], nextCursor: null });

  const now = new Date();
  const timeFloor =
    filter === "cancelled"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : now;

  const timeCeil =
    range === "future"
      ? null
      : range === "1m"
        ? addMonths(now, 1)
        : range === "3m"
          ? addMonths(now, 3)
          : addMonths(now, 12);

  const pageWhere = cursor
    ? or(
        gt(appointments.startAt, cursor.startAt),
        and(eq(appointments.startAt, cursor.startAt), gt(appointments.id, cursor.id)),
      )
    : undefined;

  const baseSelect = db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      einsatzort: appointments.einsatzort,
      customerName: customers.name,
      bereich: appointments.bereich,
      dienstart: appointments.dienstart,
      state: appointments.state,
      staffingStatus: appointments.staffingStatus,
      applicationStatus: appointmentApplications.status,
    })
    .from(appointments)
    .leftJoin(customers, eq(appointments.customerId, customers.id))
    .leftJoin(
      appointmentApplications,
      and(
        eq(appointmentApplications.appointmentId, appointments.id),
        eq(appointmentApplications.userId, user.id),
      ),
    )
    .orderBy(asc(appointments.startAt), asc(appointments.id))
    .limit(limit + 1);

  let whereClause;

  if (filter === "open") {
    whereClause = and(
      eligibleWhere(user),
      gte(appointments.startAt, timeFloor),
      timeCeil ? lt(appointments.startAt, timeCeil) : undefined,
      sql`${appointments.staffingStatus} <> 'BESETZT'`,
      isNull(appointmentApplications.id),
      pageWhere,
    );
  } else if (filter === "staffed") {
    whereClause = and(
      eligibleWhere(user),
      gte(appointments.startAt, timeFloor),
      timeCeil ? lt(appointments.startAt, timeCeil) : undefined,
      eq(appointments.staffingStatus, "BESETZT"),
      isNull(appointmentApplications.id),
      pageWhere,
    );
  } else if (filter === "all") {
    whereClause = and(
      gte(appointments.startAt, timeFloor),
      timeCeil ? lt(appointments.startAt, timeCeil) : undefined,
      or(appointmentApplications.id, eligibleWhere(user)),
      pageWhere,
    );
  } else if (filter === "reported") {
    whereClause = and(
      eq(appointments.state, "OPEN"),
      gte(appointments.startAt, timeFloor),
      timeCeil ? lt(appointments.startAt, timeCeil) : undefined,
      eq(appointmentApplications.status, "REPORTED"),
      pageWhere,
    );
  } else if (filter === "confirmed") {
    whereClause = and(
      eq(appointments.state, "OPEN"),
      gte(appointments.startAt, timeFloor),
      timeCeil ? lt(appointments.startAt, timeCeil) : undefined,
      eq(appointmentApplications.status, "CONFIRMED"),
      pageWhere,
    );
  } else {
    // cancelled
    whereClause = and(
      gte(appointments.startAt, timeFloor),
      timeCeil ? lt(appointments.startAt, timeCeil) : undefined,
      or(eq(appointments.state, "CANCELLED"), eq(appointmentApplications.status, "CANCELLED")),
      pageWhere,
    );
  }

  const rows = await baseSelect.where(whereClause);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor = hasMore
    ? makeCursor({ startAt: page[page.length - 1].startAt, id: page[page.length - 1].id })
    : null;

  return NextResponse.json({
    events: page.map((r) => ({
      id: r.id,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt ? r.endAt.toISOString() : null,
      title: r.title,
      einsatzort: r.einsatzort,
      customerName: r.customerName ?? null,
      bereich: r.bereich,
      dienstart: r.dienstart ?? null,
      state: r.state,
      staffingStatus: r.staffingStatus,
      applicationStatus: r.applicationStatus ?? null,
      isAcute: r.startAt.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000,
    })),
    nextCursor,
  });
}
