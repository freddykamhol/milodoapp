import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { db } from "@/lib/db";
import { buildEmailHtml } from "@/lib/email";
import { recomputeAppointmentStaffingStatus } from "@/lib/appointment-staffing";
import { sendNotificationEmail } from "@/lib/notification-email";
import { getViewer } from "@/lib/viewer";
import {
  appointmentApplications,
  customers,
  notificationPrefs,
  notifications,
  smtpSettings,
  users,
} from "@/db/schema";

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

  const appointment = await db.query.appointments.findFirst({ where: (t, { eq }) => eq(t.id, appointmentId) });
  if (!appointment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const prevStaffing = appointment.staffingStatus;

  const body = (await request.json().catch(() => null)) as
    | { userId?: unknown; role?: unknown }
    | null;
  const userId = Number(body?.userId);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 });
  const role = body?.role === "EL" ? "EL" : "NORMAL";

  await db
    .insert(appointmentApplications)
    .values({
      appointmentId,
      userId,
      status: "CONFIRMED",
      role,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [appointmentApplications.userId, appointmentApplications.appointmentId],
      set: { status: "CONFIRMED", role, updatedAt: new Date() },
    });

  const staffing = await recomputeAppointmentStaffingStatus(appointmentId);

  const target = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, userId),
    columns: { id: true, username: true, email: true },
  });

  const title = "Du wurdest eingeteilt";
  const when = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(appointment.startAt);
  const bodyText = `${appointment.title}\n${when}\n\nÖffne den Termin für Details.`;
  const href = `/appointments/${appointment.id}`;

  await db.insert(notifications).values({
    scope: "USER",
    userId,
    kind: "NEW_SHIFT",
    title,
    body: bodyText,
    href,
  });

  const prefs = await db.query.notificationPrefs.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.key, "NEW_SHIFT")),
  });

  const trySendProwl = async () => {
    if (!prefs?.emailEnabled) return;
    const enabledKeys = await db.query.prowlKeys.findMany({
      where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.enabled, true)),
      columns: { apiKey: true },
      limit: 5,
    });
    if (!enabledKeys.length) return;
    const text = `${appointment.title} • ${when}`;
    await Promise.all(
      enabledKeys.map(async (k) => {
        const key = k.apiKey?.trim();
        if (!key) return;
        await fetch("https://api.prowlapp.com/publicapi/add", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ apikey: key, application: "Milodo", event: title, description: text }).toString(),
        });
      }),
    );
  };

  const trySendEmail = async () => {
    if (!prefs?.emailEnabled) return;
    if (!target?.email?.trim()) return;
    await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
    const smtp = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
    if (!smtp?.enabled) return;
    if (!smtp.host || !smtp.port) return;
    const fromEmail = smtp.fromEmail?.trim() || (smtp.username?.includes("@") ? smtp.username.trim() : "");
    if (!fromEmail) return;

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: Boolean(smtp.secure),
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });

    await transporter.sendMail({
      from: fromEmail,
      to: target.email,
      subject: `[Milodo] ${title}`,
      text: `${bodyText}\n\nhttps://app.milodo-medical.de${href}`,
      html: buildEmailHtml({
        preheader: `${appointment.title} • ${when}`,
        title,
        intro: "Du wurdest einem Dienst zugeteilt.",
        sections: [
          { label: "Dienst", value: appointment.title },
          { label: "Zeit", value: when },
        ],
        button: { label: "Direkt zum Dienst", url: `https://app.milodo-medical.de${href}` },
      }),
    });
  };

  await Promise.all([trySendProwl(), trySendEmail()].map((p) => p.catch(() => null)));

  // customer notification when fully staffed
  if (appointment.approved && prevStaffing !== "BESETZT" && staffing.staffingStatus === "BESETZT") {
    try {
      const cust = await db.query.customers.findFirst({
        where: (t, { eq }) => eq(t.id, appointment.customerId),
        columns: { accountUserId: true, email: true, name: true },
      });
      if (cust?.accountUserId) {
        await db.insert(notifications).values({
          scope: "USER",
          userId: cust.accountUserId,
          kind: "SYSTEM",
          title: "Dienst besetzt",
          body: `${appointment.title}\n${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(appointment.startAt)}`,
          href: `/appointments/${appointment.id}`,
        });

        const pref = await db.query.notificationPrefs.findFirst({
          where: (t, { and, eq }) =>
            and(eq(t.userId, cust.accountUserId as number), eq(t.key, "CUSTOMER_SHIFT_FILLED")),
        });
        const target = await db.query.users.findFirst({
          where: (t, { eq }) => eq(t.id, cust.accountUserId as number),
          columns: { email: true },
        });
        const to = String(target?.email || cust.email || "").trim();
        if (pref?.emailEnabled && to) {
          void sendNotificationEmail({
            to,
            subject: "[Milodo] Dienst besetzt",
            preheader: appointment.title,
            title: "Dienst besetzt",
            intro: "Dein freigegebener Dienst ist jetzt besetzt.",
            sections: [
              { label: "Kunde", value: cust.name || "" },
              { label: "Dienst", value: appointment.title },
              { label: "Zeit", value: new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(appointment.startAt) },
            ].filter((s) => s.value),
            button: { label: "Zum Dienst", url: `https://app.milodo-medical.de/appointments/${appointment.id}` },
          }).catch(() => null);
        }
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true });
}
