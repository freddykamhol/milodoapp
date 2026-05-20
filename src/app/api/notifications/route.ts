import { NextResponse } from "next/server";
import { and, desc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { appointments, customers, notificationPrefs, notificationReads, notifications, timesheetMonths } from "@/db/schema";
import { sendNotificationEmail } from "@/lib/notification-email";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";

async function ensureDemoNotifications(viewerId: number) {
  const existingRow = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(notifications)
    .where(or(eq(notifications.scope, "ALL"), and(eq(notifications.scope, "USER"), eq(notifications.userId, viewerId))))
    .limit(1);

  const existing = existingRow.at(0)?.count ?? 0;
  if (existing > 0) return;

  const now = new Date();
  const openFutureRow = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(appointments)
    .where(and(eq(appointments.state, "OPEN"), gt(appointments.startAt, now)))
    .limit(1);

  const openFuture = openFutureRow.at(0)?.count ?? 0;

  const nextConfirmed = await db.query.appointmentApplications.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, viewerId), eq(t.status, "CONFIRMED")),
    with: { appointment: true },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const openTimesheetsRow = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(timesheetMonths)
    .where(eq(timesheetMonths.status, "OPEN"))
    .limit(1);

  const openTimesheets = openTimesheetsRow.at(0)?.count ?? 0;

  await db.insert(notifications).values([
    {
      scope: "ALL",
      kind: "NEW_SHIFT",
      title: "Neue Dienste verfügbar",
      body: openFuture ? `${openFuture} offene Dienste sind verfügbar.` : "Aktuell sind keine offenen Dienste vorhanden.",
      href: "/appointments",
    },
    nextConfirmed?.appointment
      ? {
          scope: "USER",
          userId: viewerId,
          kind: "SHIFT_REMINDER",
          title: "Nächster Dienst",
          body: `${nextConfirmed.appointment.title} • ${new Intl.DateTimeFormat("de-DE", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(nextConfirmed.appointment.startAt))}`,
          href: "/calendar",
        }
      : {
          scope: "USER",
          userId: viewerId,
          kind: "SYSTEM",
          title: "Willkommen",
          body: "Deine Benachrichtigungen werden hier gesammelt.",
          href: "",
        },
    {
      scope: "ALL",
      kind: "TIMESHEET",
      title: "Stundenzettel",
      body: openTimesheets ? `${openTimesheets} offene Monatsabschlüsse im System.` : "Keine offenen Monatsabschlüsse.",
      href: "/hours",
    },
  ]);
}

async function ensureBirthdayTestNotification() {
  const exists = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.kind, "BIRTHDAY"), eq(notifications.title, "XY Hat geburtstag!")))
    .limit(1);

  if (exists.length) return;

  await db.insert(notifications).values({
    scope: "ALL",
    kind: "BIRTHDAY",
    title: "XY Hat geburtstag!",
    body: "",
    href: "/members",
  });
}

async function ensureCustomerUnfilledReminder(viewer: { id: number; role: string; email: string | null }) {
  if (viewer.role !== "KUNDE") return;

  const pref = await db.query.notificationPrefs.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, viewer.id), eq(t.key, "CUSTOMER_SHIFT_UNFILLED_2D")),
  });
  if (!pref?.emailEnabled) return;

  const cust = await db.query.customers.findFirst({
    where: (t, { eq }) => eq(t.accountUserId, viewer.id),
    columns: { id: true, name: true, email: true },
  });
  if (!cust) return;

  const now = new Date();
  const from = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const to = new Date(from.getTime() + 6 * 60 * 60 * 1000);

  const rows = await db
    .select({ id: appointments.id, title: appointments.title, startAt: appointments.startAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.customerId, cust.id),
        eq(appointments.state, "OPEN"),
        eq(appointments.approved, true),
        sql`${appointments.staffingStatus} <> 'BESETZT'`,
        gte(appointments.startAt, from),
        lt(appointments.startAt, to),
      ),
    )
    .limit(5);

  for (const a of rows) {
    const href = `/appointments/${a.id}`;
    const exists = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.scope, "USER"), eq(notifications.userId, viewer.id), eq(notifications.title, "Dienst nicht besetzt"), eq(notifications.href, href)))
      .limit(1);
    if (exists.length) continue;

    await db.insert(notifications).values({
      scope: "USER",
      userId: viewer.id,
      kind: "SYSTEM",
      title: "Dienst nicht besetzt",
      body: `${a.title}\n${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(a.startAt)}`,
      href,
    });

    const toMail = String(viewer.email || cust.email || "").trim();
    if (toMail) {
      void sendNotificationEmail({
        to: toMail,
        subject: "[Milodo] Dienst nicht besetzt",
        preheader: a.title,
        title: "Dienst nicht besetzt",
        intro: "2 Tage vor Beginn ist der Dienst noch nicht besetzt.",
        sections: [
          { label: "Kunde", value: cust.name },
          { label: "Dienst", value: a.title },
          { label: "Zeit", value: new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(a.startAt) },
        ],
        button: { label: "Zum Dienst", url: `${getAppUrl()}${href}` },
      }).catch(() => null);
    }
  }
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const allowDemo = (process.env.ALLOW_DEMO_AUTH ?? "0") !== "0";
  if (allowDemo) {
    await ensureDemoNotifications(viewer.id).catch(() => null);
    await ensureBirthdayTestNotification().catch(() => null);
  }
  await ensureCustomerUnfilledReminder({ id: viewer.id, role: viewer.role, email: viewer.email ?? null });

  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "panel";

  const baseWhere = or(eq(notifications.scope, "ALL"), and(eq(notifications.scope, "USER"), eq(notifications.userId, viewer.id)));

  const unreadRow = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(notifications)
    .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, viewer.id)))
    .where(and(baseWhere, isNull(notificationReads.id)))
    .limit(1);

  const unreadCount = unreadRow.at(0)?.count ?? 0;

  if (view === "page") {
    const now = new Date();
    const from7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [unreadRows, recentRows] = await Promise.all([
      db
        .select({
          id: notifications.id,
          kind: notifications.kind,
          title: notifications.title,
          body: notifications.body,
          href: notifications.href,
          createdAt: notifications.createdAt,
          readId: notificationReads.id,
        })
        .from(notifications)
        .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, viewer.id)))
        .where(and(baseWhere, isNull(notificationReads.id)))
        .orderBy(desc(notifications.createdAt))
        .limit(200),
      db
        .select({
          id: notifications.id,
          kind: notifications.kind,
          title: notifications.title,
          body: notifications.body,
          href: notifications.href,
          createdAt: notifications.createdAt,
          readId: notificationReads.id,
        })
        .from(notifications)
        .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, viewer.id)))
        .where(and(baseWhere, gte(notifications.createdAt, from7)))
        .orderBy(desc(notifications.createdAt))
        .limit(200),
    ]);

    const unreadIds = new Set(unreadRows.map((r) => r.id));
    const recentOnly = recentRows.filter((r) => !unreadIds.has(r.id));

    return NextResponse.json({
      ok: true,
      unreadCount,
      unread: unreadRows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        href: r.href,
        createdAt: r.createdAt,
        read: false,
      })),
      recent: recentOnly.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        href: r.href,
        createdAt: r.createdAt,
        read: !!r.readId,
      })),
    });
  }

  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      createdAt: notifications.createdAt,
      readId: notificationReads.id,
    })
    .from(notifications)
    .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, viewer.id)))
    .where(and(baseWhere, isNull(notificationReads.id)))
    .orderBy(desc(notifications.createdAt))
    .limit(3);

  return NextResponse.json({
    ok: true,
    unreadCount,
    notifications: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      createdAt: r.createdAt,
      read: false,
    })),
  });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  const markAll = body?.all === true;
  const ids = Array.isArray(body?.ids) ? body?.ids.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];

  const baseWhere = or(eq(notifications.scope, "ALL"), and(eq(notifications.scope, "USER"), eq(notifications.userId, viewer.id)));

  const targetIds = markAll
    ? (
        await db
          .select({ id: notifications.id })
          .from(notifications)
          .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, viewer.id)))
          .where(and(baseWhere, isNull(notificationReads.id)))
          .orderBy(desc(notifications.createdAt))
          .limit(200)
      ).map((r) => r.id)
    : ids;

  if (!targetIds.length) return NextResponse.json({ ok: true });

  await db
    .insert(notificationReads)
    .values(targetIds.map((notificationId) => ({ userId: viewer.id, notificationId })))
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}
