import { NextResponse } from "next/server";
import { and, asc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentApplications, appointments, customers } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const to = parseDate(url.searchParams.get("to"), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  const userId = viewer.id;

  const rows = await db
    .select({
      appointmentId: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      einsatzort: appointments.einsatzort,
      customerName: customers.name,
      bereich: appointments.bereich,
      dienstart: appointments.dienstart,
    })
    .from(appointmentApplications)
    .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(
      and(
        eq(appointmentApplications.userId, userId),
        eq(appointmentApplications.status, "CONFIRMED"),
        gte(appointments.startAt, from),
        lt(appointments.startAt, to),
        eq(appointments.state, "OPEN"),
      ),
    )
    .orderBy(asc(appointments.startAt));

  return NextResponse.json({
    events: rows.map((r) => ({
      appointmentId: r.appointmentId,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt ? r.endAt.toISOString() : null,
      title: r.title,
      einsatzort: r.einsatzort,
      customerName: r.customerName ?? null,
      bereich: r.bereich,
      dienstart: r.dienstart ?? null,
    })),
  });
}
