import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { appointments, customers, notifications } from "@/db/schema";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { note?: unknown } | null;
  const note = String(body?.note ?? "").trim();

  const appt =
    (await db.query.appointments.findFirst({
      where: (t, { eq }) => eq(t.id, appointmentId),
      columns: { id: true, title: true, startAt: true, customerId: true, approved: true, state: true },
    })) ?? null;
  if (!appt) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await db
    .update(appointments)
    .set({ state: "CANCELLED", updatedAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.approved, false)));

  const cust =
    (await db.query.customers.findFirst({
      where: (t, { eq }) => eq(t.id, appt.customerId),
      columns: { id: true, name: true, accountUserId: true },
    })) ?? null;

  const userId = cust?.accountUserId ?? null;
  if (userId) {
    const when = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(appt.startAt);
    await db.insert(notifications).values({
      scope: "USER",
      userId,
      kind: "SYSTEM",
      title: "Kundenanforderung abgelehnt",
      body: `${cust?.name ?? "Kunde"}\n${appt.title}\n${when}${note ? `\n\nBemerkung: ${note}` : ""}`,
      href: `/appointments/${appointmentId}`,
    });
  }

  return NextResponse.json({ ok: true });
}

