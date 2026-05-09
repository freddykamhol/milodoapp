import Link from "next/link";
import { redirect } from "next/navigation";

import { and, asc, eq, getTableColumns, gte, inArray, isNull, or, sql } from "drizzle-orm";

import { AppShell } from "../_components/app-shell";
import { IconChevronRight } from "../_components/icons";
import { Badge, Card } from "../_components/ui";
import { db } from "@/lib/db";
import { appointmentApplications, appointmentRequirements, appointments, customers, users } from "@/db/schema";
import { AppointmentContextMenu } from "./_components/appointment-context-menu";
import { DashboardKpis } from "./_components/dashboard-kpis";
import { allowedAusbQuals, allowedRdQuals } from "@/lib/qual-hierarchy";
import { getViewer } from "@/lib/viewer";

type UserRow = typeof users.$inferSelect;
type AppointmentRow = typeof appointments.$inferSelect;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTimeRange(startAt: Date, endAt: Date | null) {
  if (!endAt) return formatTime(startAt);
  return `${formatTime(startAt)}–${formatTime(endAt)}`;
}

function daysUntil(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function getCurrentUser(): Promise<UserRow | null> {
  return (await getViewer()) ?? null;
}

function eligibleWhere(user: UserRow) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
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

async function getNextConfirmedAppointment(userId: number) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const appointmentCols = getTableColumns(appointments);

  const row = await db
    .select(appointmentCols)
    .from(appointmentApplications)
    .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
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

async function getKpis(user: UserRow) {
  const reportedOrConfirmed = await db
    .select({
      status: appointmentApplications.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(appointmentApplications)
    .where(
      and(
        eq(appointmentApplications.userId, user.id),
        inArray(appointmentApplications.status, ["REPORTED", "CONFIRMED"]),
      ),
    )
    .groupBy(appointmentApplications.status);

  const reported = reportedOrConfirmed.find((r) => r.status === "REPORTED")?.count ?? 0;
  const confirmed = reportedOrConfirmed.find((r) => r.status === "CONFIRMED")?.count ?? 0;

  const openCount = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(appointments)
    .where(eligibleWhere(user))
    .limit(1);

  return { open: openCount.at(0)?.count ?? 0, reported, confirmed };
}

async function getNextOpenAppointments(user: UserRow): Promise<AppointmentRow[]> {
  return db
    .select()
    .from(appointments)
    .where(eligibleWhere(user))
    .orderBy(asc(appointments.startAt))
    .limit(20);
}

function requirementsLabel(rows: Array<typeof appointmentRequirements.$inferSelect> | undefined) {
  if (!rows?.length) return "—";
  return rows
    .slice()
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value))
    .map((r) => `mind. ${r.minCount}× ${r.value}`)
    .join(" • ");
}

export default function DashboardPage() {
  return <DashboardPageInner />;
}

async function DashboardPageInner() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.role === "KUNDE") {
    const customer = await db.query.customers.findFirst({
      where: (t, { eq }) => eq(t.accountUserId, user.id),
    });

    if (!customer) {
      return (
        <AppShell title="Dashboard" subtitle="Kundenübersicht">
          <Card title="Kein Kunde verknüpft" description="Zu diesem Account ist kein Kunde hinterlegt.">
            <p className="text-sm text-[color:var(--muted)]">Bitte Admin/Verwaltung kontaktieren.</p>
          </Card>
        </AppShell>
      );
    }

    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const items = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.customerId, customer.id), eq(appointments.state, "OPEN"), gte(appointments.startAt, cutoff)))
      .orderBy(asc(appointments.startAt))
      .limit(30);

    const toneFor = (a: AppointmentRow) => {
      if (!a.approved) return "bg-[color:color-mix(in_oklab,var(--danger)_10%,transparent)]";
      if (a.staffingStatus === "BESETZT") return "bg-[color:color-mix(in_oklab,var(--success)_10%,transparent)]";
      return "bg-[color:color-mix(in_oklab,#f59e0b_10%,transparent)]";
    };

    return (
      <AppShell title="Dashboard" subtitle={`Kunde: ${customer.name}`}>
        <Card title="Meine Dienste" description="Angefordert, freigegeben und Besetzung im Überblick.">
          {!items.length ? (
            <p className="text-sm text-[color:var(--muted)]">Aktuell keine Dienste vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {items.map((a) => {
                const days = daysUntil(new Date(), new Date(a.startAt));
                return (
                  <Link
                    key={a.id}
                    href={`/appointments/${a.id}`}
                    className={[
                      "flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--border)] px-4 py-3 shadow-[var(--shadow-soft)] hover:brightness-[0.99]",
                      toneFor(a),
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-[color:var(--muted)]">
                        {formatDate(new Date(a.startAt))} • {formatTimeRange(new Date(a.startAt), a.endAt ? new Date(a.endAt) : null)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!a.approved ? <Badge tone="danger">Noch nicht freigegeben</Badge> : <Badge tone="accent">Freigegeben</Badge>}
                        <Badge tone="muted">{a.staffingStatus}</Badge>
                        <Badge tone="muted">in {days} Tagen</Badge>
                      </div>
                    </div>
                    <IconChevronRight className="h-4 w-4 text-[color:var(--muted)]" />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </AppShell>
    );
  }

  const isAdmin = user.role === "ADMIN" || user.role === "VERWALTUNG";
  const now = new Date();
  const acuteUntil = new Date(now);
  acuteUntil.setDate(acuteUntil.getDate() + 7);

  const [nextConfirmed, kpis, nextOpen] = await Promise.all([
    getNextConfirmedAppointment(user.id),
    getKpis(user),
    getNextOpenAppointments(user),
  ]);

  const [openRequirements, confirmedRequirements] = await Promise.all([
    nextOpen.length
      ? db
          .select()
          .from(appointmentRequirements)
          .where(inArray(appointmentRequirements.appointmentId, nextOpen.map((a) => a.id)))
      : Promise.resolve([]),
    nextConfirmed
      ? db
          .select()
          .from(appointmentRequirements)
          .where(eq(appointmentRequirements.appointmentId, nextConfirmed.id))
      : Promise.resolve([]),
  ]);

  const openRequirementsMap = new Map<number, Array<typeof appointmentRequirements.$inferSelect>>();
  for (const row of openRequirements) {
    const list = openRequirementsMap.get(row.appointmentId) ?? [];
    list.push(row);
    openRequirementsMap.set(row.appointmentId, list);
  }

  const displayName = String(user.firstName || "").trim() || user.username;

  return (
    <AppShell title={displayName} subtitle="Deine persönliche Übersicht">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[color:var(--muted)]">Nächster Termin</p>
            <p className="mt-1 text-sm font-semibold">Dein nächster Einsatz</p>
          </div>
          <Badge tone="accent">Live</Badge>
        </div>

        {nextConfirmed ? (
          <div className="mt-4 flex items-stretch gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-3.5">
            <div className="w-32 rounded-2xl bg-[var(--surface)] px-3 py-2 shadow-[0_10px_24px_rgba(11,18,32,0.05)]">
              <p className="text-[11px] font-semibold text-[color:var(--muted)]">
                {formatDate(nextConfirmed.startAt)}
              </p>
              <p className="mt-1 text-sm font-semibold tracking-tight">
                {formatTimeRange(nextConfirmed.startAt, nextConfirmed.endAt)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-[color:var(--muted)]">
                {nextConfirmed.endAt ? "mit Endzeit" : "ohne Endzeit"}
              </p>
            </div>

            <div className="min-w-0 flex-1 py-1">
              <p className="truncate text-sm font-semibold">{nextConfirmed.title}</p>
              <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                {nextConfirmed.einsatzort}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="success">Zugesagt</Badge>
                {confirmedRequirements.length ? (
                  <Badge tone="muted">{requirementsLabel(confirmedRequirements)}</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AppointmentContextMenu
                appointmentId={nextConfirmed.id}
                variant="confirmed"
                canManage={isAdmin}
                canTriggerInquiry={isAdmin}
                canTriggerAcuteInquiry={isAdmin && nextConfirmed.startAt <= acuteUntil}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-sm font-semibold">Kein nächster Termin</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Sobald ein Einsatz zugesagt wurde, erscheint er hier.
            </p>
          </div>
        )}
      </section>

      <DashboardKpis initial={kpis} />

      <Card
        title="Nächste offene Termine"
        description="Top 20 offene Termine, die aufgrund deiner Qualifikationen oder Zielzuweisung passen."
        actions={
          <Link
            href="/appointments"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent)] hover:underline"
          >
            Alle Termine
            <IconChevronRight className="h-4 w-4" />
          </Link>
        }
      >
        {nextOpen.length ? (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <div className="min-w-[720px] grid grid-cols-[140px_1fr_160px_44px] gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]">
              <div>Datum/Zeit</div>
              <div>Titel</div>
              <div>Einsatzort</div>
              <div className="text-right">Aktion</div>
            </div>
            <ul className="min-w-[720px] divide-y divide-[var(--border)] bg-[var(--surface)]">
              {nextOpen.map((item) => {
                const isAcute = item.startAt <= acuteUntil && item.startAt >= now;
                const days = daysUntil(now, item.startAt);

                return (
                  <li
                    key={item.id}
                    className={[
                      "grid grid-cols-[140px_1fr_160px_44px] items-center gap-3 px-4 py-3",
                      isAcute ? "bg-[color:color-mix(in_oklab,var(--danger)_6%,transparent)]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="text-xs font-semibold text-[color:var(--muted)]">
                      <div className="truncate">{formatDate(item.startAt)}</div>
                      <div className="mt-0.5 text-[11px] font-medium">
                        {formatTimeRange(item.startAt, item.endAt)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        {isAcute ? <Badge tone="danger">in {days} Tagen</Badge> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                        {requirementsLabel(openRequirementsMap.get(item.id))}{" "}
                        {item.targetUserId === user.id ? " • Zielzuweisung" : ""}
                      </p>
                    </div>
                    <div className="truncate text-xs font-semibold">{item.einsatzort}</div>
                    <div className="flex justify-end">
                      <AppointmentContextMenu
                        appointmentId={item.id}
                        canManage={isAdmin}
                        canTriggerInquiry={isAdmin}
                        canTriggerAcuteInquiry={isAdmin && item.startAt <= acuteUntil}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            Keine passenden offenen Termine gefunden.
          </p>
        )}
      </Card>
    </AppShell>
  );
}
