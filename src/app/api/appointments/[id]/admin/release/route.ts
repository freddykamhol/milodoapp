import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { appointments, customers, notificationPrefs, notifications, users } from "@/db/schema";
import { triggerAppointmentInquiry } from "@/lib/appointment-inquiry";
import { sendNotificationEmail } from "@/lib/notification-email";
import { eq } from "drizzle-orm";
import { getViewer } from "@/lib/viewer";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";

function requestKindFor(appointment: { startAt: Date; detailsJson: string | null }) {
  const within7Days = appointment.startAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
  let acuteEnabled = true;
  try {
    const parsed = appointment.detailsJson ? (JSON.parse(appointment.detailsJson) as Record<string, unknown>) : null;
    if (parsed && typeof parsed.acuteInquiryEnabled === "boolean") acuteEnabled = parsed.acuteInquiryEnabled;
  } catch {
    // ignore
  }
  return within7Days && acuteEnabled ? ("URGENT_REQUESTS" as const) : ("REQUESTS_GENERAL" as const);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const appointment = await db.query.appointments.findFirst({
    where: (t, { eq }) => eq(t.id, appointmentId),
    columns: { id: true, title: true, startAt: true, endAt: true, approved: true, detailsJson: true },
  });
  if (!appointment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (appointment.approved) return NextResponse.json({ ok: true, alreadyApproved: true });

  await db
    .update(appointments)
    .set({ approved: true, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));

  // customer notification (mail + in-app) if linked
  try {
    const full = await db.query.appointments.findFirst({
      where: (t, { eq }) => eq(t.id, appointmentId),
      columns: { id: true, customerId: true, title: true, startAt: true },
    });
    if (full) {
      const cust = await db.query.customers.findFirst({
        where: (t, { eq }) => eq(t.id, full.customerId),
        columns: { name: true, accountUserId: true, email: true },
      });
      if (cust?.accountUserId) {
        await db.insert(notifications).values({
          scope: "USER",
          userId: cust.accountUserId,
          kind: "SYSTEM",
          title: "Dienst freigegeben",
          body: `${full.title}\n${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(full.startAt)}`,
          href: `/appointments/${appointmentId}`,
        });

        const pref = await db.query.notificationPrefs.findFirst({
          where: (t, { and, eq }) =>
            and(eq(t.userId, cust.accountUserId as number), eq(t.key, "CUSTOMER_SHIFT_RELEASED")),
        });

        const target = await db.query.users.findFirst({
          where: (t, { eq }) => eq(t.id, cust.accountUserId as number),
          columns: { email: true },
        });

        const to = String(target?.email || cust.email || "").trim();
        if (pref?.emailEnabled && to) {
          void sendNotificationEmail({
            to,
            subject: "[Milodo] Dienst freigegeben",
            preheader: `${full.title} • ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(full.startAt)}`,
            title: "Dienst freigegeben",
            intro: "Dein angeforderter Dienst wurde freigegeben. Die Abfrage wird gestartet.",
            sections: [{ label: "Dienst", value: full.title }],
            button: { label: "Zum Dienst", url: `${getAppUrl()}/appointments/${appointmentId}` },
          }).catch(() => null);
        }
      }
    }
  } catch {
    // ignore
  }

  const kind = requestKindFor({ startAt: appointment.startAt, detailsJson: appointment.detailsJson });

  await db.insert(notifications).values({
    scope: "ALL",
    kind,
    title: kind === "URGENT_REQUESTS" ? "AKUTE ABFRAGE" : "Dienstabfrage",
    body: `${appointment.title}\n${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
      appointment.startAt,
    )}`,
    href: `/appointments/${appointmentId}`,
  });

  const result = await triggerAppointmentInquiry(appointmentId, kind).catch(() => null);

  return NextResponse.json({ ok: true, kind, result });
}
