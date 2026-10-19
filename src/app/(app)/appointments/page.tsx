import { dateFormatter } from "@/lib/date-format";
import { and, asc, eq, gte, gt, isNull, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AppShell } from "../_components/app-shell";
import { Badge, Card, Kpi } from "../_components/ui";
import { db } from "@/lib/db";
import {
  appointmentApplications,
  appointmentRequirements,
  appointments,
  customers,
  users,
} from "@/db/schema";
import { AppointmentContextMenu } from "../dashboard/_components/appointment-context-menu";
import { AppointmentsClient, type AppointmentFeedItem } from "./_components/appointments-client";
import { allowedAusbQuals, allowedRdQuals } from "@/lib/qual-hierarchy";
import { getViewer } from "@/lib/viewer";
import { serviceAreaLabel } from "@/lib/service-area-label";

export const dynamic = "force-dynamic";

type UserRow = typeof users.$inferSelect;

function formatDate(date: Date) {
  return dateFormatter({
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return dateFormatter({ hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatTimeRange(startAt: Date, endAt: Date | null) {
  if (!endAt) return formatTime(startAt);
  return `${formatTime(startAt)}–${formatTime(endAt)}`;
}

function eligibleWhere(user: UserRow, now: Date) {
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const targeted = eq(appointments.targetUserId, user.id);
  const openAndFuture = and(eq(appointments.state, "OPEN"), gte(appointments.startAt, cutoff));

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

async function getNextAssigned(userId: number) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const row = await db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      einsatzort: appointments.einsatzort,
      customerName: customers.name,
      dienstart: appointments.dienstart,
      bereich: appointments.bereich,
    })
    .from(appointmentApplications)
    .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
    .leftJoin(customers, eq(appointments.customerId, customers.id))
    .where(
      and(
        eq(appointmentApplications.userId, userId),
        eq(appointmentApplications.status, "CONFIRMED"),
        eq(appointments.state, "OPEN"),
        gte(appointments.startAt, cutoff),
      ),
    )
    .orderBy(asc(appointments.startAt))
    .limit(1);

  return row.at(0) ?? null;
}

async function getCounts(user: UserRow) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);

  const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const eligible = eligibleWhere(user, now);
  const rows = await db
    .select({
      open: sql<number>`coalesce(sum(case when (${eligible}) and ${appointmentApplications.id} is null and ${appointments.staffingStatus} <> 'BESETZT' then 1 else 0 end), 0)`.as("open"),
      staffed: sql<number>`coalesce(sum(case when (${eligible}) and ${appointmentApplications.id} is null and ${appointments.staffingStatus} = 'BESETZT' then 1 else 0 end), 0)`.as("staffed"),
      reported: sql<number>`coalesce(sum(case when ${appointmentApplications.userId} = ${user.id} and ${appointmentApplications.status} = 'REPORTED' and ${appointments.state} = 'OPEN' and ${appointments.startAt} >= ${cutoff.getTime()} then 1 else 0 end), 0)`.as("reported"),
      confirmed: sql<number>`coalesce(sum(case when ${appointmentApplications.userId} = ${user.id} and ${appointmentApplications.status} = 'CONFIRMED' and ${appointments.state} = 'OPEN' and ${appointments.startAt} >= ${cutoff.getTime()} then 1 else 0 end), 0)`.as("confirmed"),
      cancelled: sql<number>`coalesce(sum(case when ${appointments.startAt} > ${cutoff30.getTime()} and (${appointments.state} = 'CANCELLED' or ${appointmentApplications.status} = 'CANCELLED') then 1 else 0 end), 0)`.as("cancelled"),
    })
    .from(appointments)
    .leftJoin(appointmentApplications, and(eq(appointmentApplications.appointmentId, appointments.id), eq(appointmentApplications.userId, user.id)));

  return rows[0] ?? { open: 0, staffed: 0, reported: 0, confirmed: 0, cancelled: 0 };
}

async function getInitialOpenItems(user: UserRow) {
  const now = new Date();
  const rows = await db
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
    .where(and(eligibleWhere(user, now), isNull(appointmentApplications.id), sql`${appointments.staffingStatus} <> 'BESETZT'`))
    .orderBy(asc(appointments.startAt), asc(appointments.id))
    .limit(11);

  const hasMore = rows.length > 10;
  const page = hasMore ? rows.slice(0, 10) : rows;
  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ s: page[page.length - 1].startAt.getTime(), id: page[page.length - 1].id }), "utf8").toString("base64url")
    : null;

  const items: AppointmentFeedItem[] = page.map((r) => ({
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
    isAcute: r.startAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000,
  }));

  return { items, nextCursor };
}

export default async function AppointmentsPage() {
  const user = await getViewer();
  if (!user) redirect("/login");

  const [nextAssigned, counts, initial] = await Promise.all([
    getNextAssigned(user.id),
    getCounts(user),
    getInitialOpenItems(user),
  ]);

  const canCreate = user.role === "ADMIN" || user.role === "VERWALTUNG";
  const acuteUntil = new Date();
  acuteUntil.setDate(acuteUntil.getDate() + 7);

  return (
    <AppShell title="Termine / Dienste" subtitle="Deine Termine und Meldungen.">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[color:var(--muted)]">Nächster zugeteilter Termin</p>
            <p className="mt-1 text-sm font-semibold">Dein nächster Einsatz</p>
          </div>
          <Badge tone="success">Eingeteilt</Badge>
        </div>

        {nextAssigned ? (
          <div className="mt-4 flex items-stretch gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-3.5">
            <div className="w-32 rounded-2xl bg-[var(--surface)] px-3 py-2 shadow-[0_10px_24px_rgba(11,18,32,0.05)]">
              <p className="text-[11px] font-semibold text-[color:var(--muted)]">
                {formatDate(nextAssigned.startAt)}
              </p>
              <p className="mt-1 text-sm font-semibold tracking-tight">
                {formatTimeRange(nextAssigned.startAt, nextAssigned.endAt)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-[color:var(--muted)]">
                {nextAssigned.dienstart ? `${nextAssigned.dienstart} • ` : ""}
                {serviceAreaLabel(nextAssigned.bereich)}
              </p>
            </div>

            <div className="min-w-0 flex-1 py-1">
              <p className="truncate text-sm font-semibold">{nextAssigned.title}</p>
              <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                {nextAssigned.customerName ? `${nextAssigned.customerName} • ` : ""}
                {nextAssigned.einsatzort}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <AppointmentContextMenu
                appointmentId={nextAssigned.id}
                variant="confirmed"
                canManage={canCreate}
                canTriggerInquiry={canCreate}
                canTriggerAcuteInquiry={canCreate && nextAssigned.startAt <= acuteUntil}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-sm font-semibold">Keine Meldung vorhanden</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Sobald du gemeldet oder eingeteilt bist, erscheint der nächste Termin hier.
            </p>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-5">
          <Kpi label="Offen" value={String(counts.open)} change="passend" tone="accent" />
        </Card>
        <Card className="p-5">
          <Kpi label="Gemeldet" value={String(counts.reported)} change="wartet" tone="warning" />
        </Card>
        <Card className="p-5">
          <Kpi label="Eingeteilt" value={String(counts.confirmed)} change="fix" tone="success" />
        </Card>
        <Card className="p-5">
          <Kpi label="Abgesagt" value={String(counts.cancelled)} change="30 Tage" tone="danger" />
        </Card>
      </section>

      <AppointmentsClient
        initialFilter="open"
        initialRange="future"
        initialItems={initial.items}
        initialCursor={initial.nextCursor}
        counts={counts}
        canCreate={canCreate}
      />
    </AppShell>
  );
}
