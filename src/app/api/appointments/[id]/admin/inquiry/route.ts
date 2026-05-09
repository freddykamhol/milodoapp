import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { triggerAppointmentInquiry } from "@/lib/appointment-inquiry";
import { getViewer } from "@/lib/viewer";

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

  const body = (await request.json().catch(() => null)) as { kind?: unknown } | null;
  const kind = body?.kind === "URGENT_REQUESTS" ? "URGENT_REQUESTS" : "REQUESTS_GENERAL";

  const appointment = await db.query.appointments.findFirst({
    where: (t, { eq }) => eq(t.id, appointmentId),
    columns: { id: true, startAt: true },
  });
  if (!appointment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const within7Days = appointment.startAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (kind === "URGENT_REQUESTS" && !within7Days) {
    return NextResponse.json({ ok: false, error: "not_acute_window" }, { status: 409 });
  }

  const result = await triggerAppointmentInquiry(appointmentId, kind);
  if (!result.anyOk) {
    let message = "no_channel_succeeded";
    for (const ch of [result.telegram, result.email, result.prowl]) {
      if (ch.ok) continue;
      if (ch.skipped) continue;
      message = ch.message || ch.error || message;
      break;
    }
    return NextResponse.json({ ok: false, error: "send_failed", message, result }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result });
}
