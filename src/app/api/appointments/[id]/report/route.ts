import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { appointmentApplications, notifications } from "@/db/schema";
import { sendReportConfirmationEmail } from "@/lib/report-confirmation-email";
import { getViewer } from "@/lib/viewer";

function formatWhen(startAt: Date, endAt: Date | null) {
  const fmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  if (!endAt) return fmt.format(startAt);
  const timeFmt = new Intl.DateTimeFormat("de-DE", { timeStyle: "short" });
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

  const appointment = await db.query.appointments.findFirst({
    where: (table, { eq }) => eq(table.id, appointmentId),
  });

  if (!appointment) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const ended = appointment.endAt ? appointment.endAt < cutoff : appointment.startAt < cutoff;

  if (appointment.state !== "OPEN" || ended) {
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
    const appUrl = String(process.env.APP_URL || "https://app.milodo-medical.de").replace(/\/+$/, "");
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
