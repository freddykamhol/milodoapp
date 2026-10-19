import { dateFormatter } from "@/lib/date-format";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { appointmentApplications, notifications } from "@/db/schema";
import { sendReportConfirmationEmail } from "@/lib/report-confirmation-email";
import { getViewer } from "@/lib/viewer";
import { getAppUrl } from "@/lib/app-url";
import { recomputeAppointmentStaffingStatus, setApplicationState } from "@/lib/appointment-staffing";
import { allowedAusbQuals, allowedRdQuals } from "@/lib/qual-hierarchy";

function formatWhen(startAt: Date, endAt: Date | null) {
  const fmt = dateFormatter({ dateStyle: "medium", timeStyle: "short" });
  if (!endAt) return fmt.format(startAt);
  const timeFmt = dateFormatter({ timeStyle: "short" });
  return `${fmt.format(startAt)}–${timeFmt.format(endAt)}`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role === "KUNDE") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const appointment = await db.query.appointments.findFirst({
    where: (table, { eq }) => eq(table.id, appointmentId),
  });

  if (!appointment) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (!appointment.approved || (viewer.role === "PERSONAL" && appointment.targetUserId && appointment.targetUserId !== viewer.id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (viewer.role === "PERSONAL") {
    const requirements = await db.query.appointmentRequirements.findMany({ where: (t, { eq }) => eq(t.appointmentId, appointmentId) });
    const rd = allowedRdQuals(viewer.qualRD), ausb = allowedAusbQuals({ qualRD: viewer.qualRD, qualAusb: viewer.qualAusb });
    if (requirements.length && !requirements.some(requirement => requirement.kind === "QUAL_RD" ? rd.includes(requirement.value as typeof rd[number]) : ausb.includes(requirement.value as typeof ausb[number]))) return NextResponse.json({ ok: false, error: "qualification_required" }, { status: 403 });
  }
  const existing = await db.query.appointmentApplications.findFirst({ where: (t, { and, eq }) => and(eq(t.appointmentId, appointmentId), eq(t.userId, viewer.id)) });
  if (existing?.status === "CONFIRMED") return NextResponse.json({ ok: false, error: "already_confirmed" }, { status: 409 });

  if (appointment.state !== "OPEN") {
    return NextResponse.json({ ok: false, error: "not_open" }, { status: 409 });
  }

  if (appointment.staffingStatus === "BESETZT") {
    return NextResponse.json({ ok: false, error: "already_staffed" }, { status: 409 });
  }

  await db
    .insert(appointmentApplications)
    .values({
      appointmentId,
      userId: viewer.id,
      status: "REPORTED",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [appointmentApplications.userId, appointmentApplications.appointmentId],
      set: { status: "REPORTED", updatedAt: new Date() },
    });

  // In-App Benachrichtigung
  try {
    await db.insert(notifications).values({
      scope: "USER",
      userId: viewer.id,
      kind: "SHIFT_CHANGE",
      title: "Meldung bestätigt",
      body: `${appointment.title} • ${formatWhen(appointment.startAt, appointment.endAt ?? null)}`,
      href: `/appointments/${appointmentId}`,
    });
  } catch {
    // ignore
  }

  // E-Mail Bestätigung (falls SMTP aktiv)
  const email = String(viewer.email || "").trim();
  if (email) {
    const appUrl = getAppUrl();
    const appointmentUrl = `${appUrl}/appointments/${appointmentId}`;
    sendReportConfirmationEmail({
      to: email,
      appointmentTitle: appointment.title,
      appointmentWhen: formatWhen(appointment.startAt, appointment.endAt ?? null),
      appointmentUrl,
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer(); if (!viewer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (viewer.role === "KUNDE") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const appointmentId = Number((await params).id); if (!Number.isSafeInteger(appointmentId)) return NextResponse.json({ error: "Ungültige Terminnummer" }, { status: 400 });
  const appointment = await db.query.appointments.findFirst({ where: (t, { eq }) => eq(t.id, appointmentId) }); if (!appointment) return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  if (appointment.state !== "OPEN") return NextResponse.json({ error: "Der Dienst ist geschlossen." }, { status: 409 });
  const previous = setApplicationState(appointmentId, viewer.id, "CANCELLED"); if (!previous) return NextResponse.json({ error: "Keine Meldung zu diesem Dienst gefunden." }, { status: 404 });
  await recomputeAppointmentStaffingStatus(appointmentId);
  if (previous.status !== "CANCELLED") await db.insert(notifications).values({ scope: "USER", userId: viewer.id, kind: "SHIFT_CHANGE", title: "Dienst abgesagt", body: appointment.title, href: `/appointments/${appointmentId}` });
  return NextResponse.json({ ok: true });
}
