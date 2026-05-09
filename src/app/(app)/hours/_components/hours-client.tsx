"use client";

import * as React from "react";

import { Badge, Card } from "../../_components/ui";

type Entry = {
  id: number;
  appointmentId: number;
  actualStartAt: string;
  actualEndAt: string;
  title: string;
  einsatzort: string;
  customerName: string | null;
  dienstart: string | null;
};

type Viewer = {
  id: number;
  username: string;
  role: "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
};

type MemberSummary = {
  id: number;
  username: string;
  role: "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
  isClosedCurrentMonth: boolean;
  lastClosedLabel: string;
};

type TimesheetMonthSummary = {
  year: number;
  month: number; // 1-12
  status: "OPEN" | "CLOSED";
  hasData: boolean;
};

type TimesheetYearSummary = {
  year: number;
  months: TimesheetMonthSummary[];
};

function formatMonthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
}

function minutesToLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${pad2(m)}m`;
}

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function HoursClient({
  viewer,
  initialYear,
  initialMonth,
  initialStatus,
  initialReopen,
  initialTotalMinutes,
  initialEntries,
  initialForUserId,
  initialForUserName,
  members: initialMembers = [],
  initialTimesheets = [],
}: {
  viewer: Viewer;
  initialYear: number;
  initialMonth: number;
  initialStatus: "OPEN" | "CLOSED";
  initialReopen: { note: string; actorName: string; createdAt: string } | null;
  initialTotalMinutes: number;
  initialEntries: Entry[];
  initialForUserId: number;
  initialForUserName: string;
  members?: MemberSummary[];
  initialTimesheets?: TimesheetYearSummary[];
}) {
  const [year, setYear] = React.useState(initialYear);
  const [month, setMonth] = React.useState(initialMonth);
  const [status, setStatus] = React.useState<"OPEN" | "CLOSED">(initialStatus);
  const [reopenInfo, setReopenInfo] = React.useState<{ note: string; actorName: string; createdAt: string } | null>(
    initialReopen ?? null,
  );
  const [totalMinutes, setTotalMinutes] = React.useState(initialTotalMinutes);
  const [entries, setEntries] = React.useState<Entry[]>(initialEntries);
  const [isLoading, setIsLoading] = React.useState(false);

  const [forUserId, setForUserId] = React.useState(initialForUserId);
  const [forUserName, setForUserName] = React.useState(initialForUserName);
  const [members, setMembers] = React.useState<MemberSummary[]>(initialMembers);
  const [timesheets, setTimesheets] = React.useState<TimesheetYearSummary[]>(initialTimesheets);

  const today = new Date();
  const maxYear = today.getFullYear();
  const maxMonth = today.getMonth() + 1;

  const [reopen, setReopen] = React.useState<{ open: boolean; year: number; month: number; note: string }>({
    open: false,
    year: maxYear,
    month: maxMonth,
    note: "",
  });

  const [edit, setEdit] = React.useState<{
    open: boolean;
    id: number | null;
    start: string;
    end: string;
    title: string;
  }>({ open: false, id: null, start: "", end: "", title: "" });

  const isAdminView = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const [hoursView, setHoursView] = React.useState<"MEINE" | "MITGLIEDER">("MEINE");
  const gridCols = "grid-cols-[160px_1fr_220px_120px_120px_90px]";

  const title = formatMonthTitle(year, month);
  const nextDisabled = year > maxYear || (year === maxYear && month >= maxMonth);

  const exportSearch = new URLSearchParams({
    year: String(year),
    month: String(month),
    ...(isAdminView ? { userId: String(forUserId) } : {}),
  }).toString();

  async function refreshMembers(nextYear: number, nextMonth: number) {
    if (!isAdminView) return;
    try {
      const params = new URLSearchParams({ year: String(nextYear), month: String(nextMonth) });
      const res = await fetch(`/api/hours/members?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { members: MemberSummary[] };
      if (Array.isArray(data.members)) setMembers(data.members);
    } catch {
      // ignore
    }
  }

  async function loadTimesheets(nextForUserId: number, nextForUserName: string) {
    if (!isAdminView) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ userId: String(nextForUserId) });
      const res = await fetch(`/api/hours/timesheets?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      const data = (await res.json()) as { ok: boolean; years: TimesheetYearSummary[] };
      if (data.ok && Array.isArray(data.years)) setTimesheets(data.years);
      setForUserId(nextForUserId);
      setForUserName(nextForUserName);
      await refreshMembers(maxYear, maxMonth);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function load(nextYear: number, nextMonth: number, nextForUserId = forUserId, nextForUserName = forUserName) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(nextYear),
        month: String(nextMonth),
        ...(isAdminView ? { userId: String(nextForUserId) } : {}),
      });
      const res = await fetch(`/api/hours/month?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      const data = (await res.json()) as {
        month: { year: number; month: number; status: "OPEN" | "CLOSED" };
        reopen: { note: string; actorName: string; createdAt: string } | null;
        totalMinutes: number;
        entries: Entry[];
      };
      setYear(data.month.year);
      setMonth(data.month.month);
      setStatus(data.month.status);
      setReopenInfo(data.reopen ?? null);
      setTotalMinutes(data.totalMinutes);
      setEntries(data.entries);
      setForUserId(nextForUserId);
      setForUserName(nextForUserName);
      void refreshMembers(nextYear, nextMonth);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  const personalPanel = (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[color:var(--muted)]">Stundenübersicht</p>
            <p className="mt-1 truncate text-lg font-semibold tracking-tight">{title}</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Vergangene Dienste • Start/Ende anpassbar • Monatsabschluss möglich
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date(year, month - 2, 1);
                void load(d.getFullYear(), d.getMonth() + 1);
              }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.05)] hover:bg-[var(--surface-2)]"
              aria-label="Vorheriger Monat"
            >
              ←
            </button>
            <button
              type="button"
              disabled={nextDisabled}
              onClick={() => {
                const d = new Date(year, month, 1);
                void load(d.getFullYear(), d.getMonth() + 1);
              }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.05)] hover:bg-[var(--surface-2)] disabled:opacity-60"
              aria-label="Nächster Monat"
            >
              →
            </button>
            <Badge tone={status === "CLOSED" ? "success" : "warning"}>
              {status === "CLOSED" ? "Abgeschlossen" : "Offen"}
            </Badge>
          </div>
        </div>
      </section>

      {status === "OPEN" && reopenInfo ? (
        <section className="rounded-3xl border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border))] bg-[color:color-mix(in_oklab,var(--accent)_8%,transparent)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <p className="text-sm font-semibold tracking-tight">Bearbeitung freigegeben</p>
          <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
            {reopenInfo.actorName} •{" "}
            {new Intl.DateTimeFormat("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(reopenInfo.createdAt))}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm">{reopenInfo.note}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold text-[color:var(--muted)]">Einträge</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{entries.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-[color:var(--muted)]">Gesamt</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{minutesToLabel(totalMinutes)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-[color:var(--muted)]">Export</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={`/api/hours/month/csv?${exportSearch}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
            >
              CSV
            </a>
            <a
              href={`/api/hours/month/pdf?${exportSearch}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
            >
              PDF
            </a>
          </div>
        </Card>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Monatszettel</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Nach dem Abschluss sind Änderungen gesperrt.
            </p>
          </div>
          <button
            type="button"
            disabled={status === "CLOSED" || isLoading}
            onClick={async () => {
              if (!confirm("Monat wirklich abschließen? Danach sind Änderungen gesperrt.")) return;
              try {
                const res = await fetch("/api/hours/month/close", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ year, month }),
                });
                if (!res.ok) throw new Error("close_failed");
                setStatus("CLOSED");
              } catch {
                window.alert("Abschluss fehlgeschlagen.");
              }
            }}
            className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
          >
            Monatszettel abschließen
          </button>
        </div>
      </section>

      <div className="min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="min-w-[820px]">
          <div className={["grid gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]", gridCols].join(" ")}>
            <div>Datum</div>
            <div>Titel</div>
            <div>Ort</div>
            <div>Start</div>
            <div>Ende</div>
            <div className="text-right">Aktion</div>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {entries.map((e) => {
              const start = new Date(e.actualStartAt);
              const end = new Date(e.actualEndAt);
              const mins = diffMinutes(start, end);
              return (
                <li
                  key={e.id}
                  className={["grid items-center gap-3 px-4 py-3", gridCols].join(" ")}
                >
                  <div className="text-xs font-semibold text-[color:var(--muted)]">
                    <div className="truncate">
                      {new Intl.DateTimeFormat("de-DE", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }).format(start)}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium">{minutesToLabel(mins)}</div>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                      {e.customerName ? `${e.customerName} • ` : ""}
                      {e.dienstart ? `${e.dienstart} • ` : ""}
                      #{e.appointmentId}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{e.einsatzort}</p>
                  </div>
                  <div className="text-xs font-semibold">{toLocalDatetimeInputValue(start).slice(11)}</div>
                  <div className="text-xs font-semibold">{toLocalDatetimeInputValue(end).slice(11)}</div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={status === "CLOSED"}
                      onClick={() =>
                        setEdit({
                          open: true,
                          id: e.id,
                          start: toLocalDatetimeInputValue(start),
                          end: toLocalDatetimeInputValue(end),
                          title: e.title,
                        })
                      }
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
                    >
                      Anpassen
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[color:var(--muted)]">
              Keine vergangenen Dienste in diesem Monat.
            </p>
          ) : null}
        </div>
      </div>

      {edit.open ? (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEdit({ open: false, id: null, start: "", end: "", title: "" })}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">Zeiten anpassen</p>
                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">{edit.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setEdit({ open: false, id: null, start: "", end: "", title: "" })}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Schließen
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Start</span>
                <input
                  type="datetime-local"
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={edit.start}
                  onChange={(e) => setEdit((s) => ({ ...s, start: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Ende</span>
                <input
                  type="datetime-local"
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={edit.end}
                  onChange={(e) => setEdit((s) => ({ ...s, end: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEdit({ open: false, id: null, start: "", end: "", title: "" })}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!edit.id) return;
                  try {
                    const res = await fetch(`/api/hours/entry/${edit.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        actualStartAt: new Date(edit.start).toISOString(),
                        actualEndAt: new Date(edit.end).toISOString(),
                      }),
                    });
                    if (!res.ok) throw new Error("save_failed");
                    await load(year, month);
                    setEdit({ open: false, id: null, start: "", end: "", title: "" });
                  } catch {
                    window.alert("Speichern fehlgeschlagen.");
                  }
                }}
                className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (!isAdminView) return personalPanel;

  function monthLabel(y: number, m: number) {
    return new Intl.DateTimeFormat("de-DE", { month: "long" }).format(new Date(y, m - 1, 1));
  }

  const currentYearSummary = timesheets.find((y) => y.year === maxYear) ?? { year: maxYear, months: [] };
  const pastYears = timesheets.filter((y) => y.year !== maxYear).sort((a, b) => b.year - a.year);

  const adminPanel = (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[color:var(--muted)]">Mitglieder</p>
            <p className="mt-1 truncate text-sm font-semibold tracking-tight">{formatMonthTitle(maxYear, maxMonth)}</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Grün = abgeschlossen • Rot = offen
            </p>
          </div>
          <Badge>{members.length}</Badge>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {members.map((m) => {
            const isSelected = m.id === forUserId;
            const tone = m.isClosedCurrentMonth ? "success" : "danger";
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => void loadTimesheets(m.id, m.username)}
                className={[
                  "w-full rounded-2xl border px-3 py-3 text-left shadow-[0_10px_24px_rgba(11,18,32,0.04)] transition",
                  isSelected
                    ? "border-[color:var(--ring)] bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "h-2.5 w-2.5 rounded-full",
                          m.isClosedCurrentMonth ? "bg-emerald-500" : "bg-rose-500",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                      <p className="truncate text-sm font-semibold">{m.username}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                      {m.role === "PERSONAL" ? "Personal" : m.role === "VERWALTUNG" ? "Verwaltung" : "Admin"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={tone}>{m.isClosedCurrentMonth ? "Abgeschlossen" : "Offen"}</Badge>
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">{m.lastClosedLabel}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[color:var(--muted)]">Stundenzettel abrufen</p>
              <p className="mt-1 truncate text-lg font-semibold tracking-tight">{forUserName}</p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Monatsweise Downloads als CSV/PDF • Bearbeitung nur nach Freigabe
              </p>
            </div>
            <Badge tone="accent">User #{forUserId}</Badge>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight">{maxYear}</p>
            <Badge tone="muted">Aktuelles Jahr</Badge>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {currentYearSummary.months.map((m) => {
              const ym = `${String(m.month).padStart(2, "0")}/${String(m.year % 100).padStart(2, "0")}`;
              const canDownload = m.hasData;
              const linkSearch = new URLSearchParams({
                year: String(m.year),
                month: String(m.month),
                userId: String(forUserId),
              }).toString();
              return (
                <Card key={`${m.year}-${m.month}`} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{monthLabel(m.year, m.month)}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">{ym}</p>
                    </div>
                    <Badge tone={m.status === "CLOSED" ? "success" : "danger"}>
                      {m.status === "CLOSED" ? "Abgeschlossen" : "Offen"}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/hours/month/csv?${linkSearch}`}
                      className={[
                        "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]",
                        canDownload ? "" : "pointer-events-none opacity-50",
                      ].join(" ")}
                    >
                      CSV
                    </a>
                    <a
                      href={`/api/hours/month/pdf?${linkSearch}`}
                      target="_blank"
                      rel="noreferrer"
                      className={[
                        "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]",
                        canDownload ? "" : "pointer-events-none opacity-50",
                      ].join(" ")}
                    >
                      PDF
                    </a>

                    {m.status === "CLOSED" ? (
                      <button
                        type="button"
                        onClick={() => setReopen({ open: true, year: m.year, month: m.month, note: "" })}
                        className="rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
                      >
                        Bearbeitung freigeben
                      </button>
                    ) : null}
                  </div>

                  {!m.hasData ? (
                    <p className="mt-3 text-xs text-[color:var(--muted)]">Keine Einträge in diesem Monat.</p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </section>

        {pastYears.length ? (
          <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <p className="text-sm font-semibold tracking-tight">Vorjahre</p>
            <div className="mt-3 flex flex-col gap-3">
              {pastYears.map((y) => (
                <details key={y.year} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Ordner {y.year}</p>
                      <Badge tone="muted">{y.months.length} Monate</Badge>
                    </div>
                  </summary>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {y.months.map((m) => {
                      const ym = `${String(m.month).padStart(2, "0")}/${String(m.year % 100).padStart(2, "0")}`;
                      const canDownload = m.hasData;
                      const linkSearch = new URLSearchParams({
                        year: String(m.year),
                        month: String(m.month),
                        userId: String(forUserId),
                      }).toString();
                      return (
                        <Card key={`${m.year}-${m.month}`} className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{monthLabel(m.year, m.month)}</p>
                              <p className="mt-1 text-xs text-[color:var(--muted)]">{ym}</p>
                            </div>
                            <Badge tone={m.status === "CLOSED" ? "success" : "danger"}>
                              {m.status === "CLOSED" ? "Abgeschlossen" : "Offen"}
                            </Badge>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <a
                              href={`/api/hours/month/csv?${linkSearch}`}
                              className={[
                                "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]",
                                canDownload ? "" : "pointer-events-none opacity-50",
                              ].join(" ")}
                            >
                              CSV
                            </a>
                            <a
                              href={`/api/hours/month/pdf?${linkSearch}`}
                              target="_blank"
                              rel="noreferrer"
                              className={[
                                "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]",
                                canDownload ? "" : "pointer-events-none opacity-50",
                              ].join(" ")}
                            >
                              PDF
                            </a>

                            {m.status === "CLOSED" ? (
                              <button
                                type="button"
                                onClick={() => setReopen({ open: true, year: m.year, month: m.month, note: "" })}
                                className="rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
                              >
                                Bearbeitung freigeben
                              </button>
                            ) : null}
                          </div>
                          {!m.hasData ? (
                            <p className="mt-3 text-xs text-[color:var(--muted)]">Keine Einträge in diesem Monat.</p>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {reopen.open ? (
          <div
            className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setReopen({ open: false, year: maxYear, month: maxMonth, note: "" })}
          >
            <div
              className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">Bearbeitung freigeben</p>
                  <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                    {forUserName} • {String(reopen.month).padStart(2, "0")}/{String(reopen.year % 100).padStart(2, "0")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReopen({ open: false, year: maxYear, month: maxMonth, note: "" })}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Schließen
                </button>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Bemerkung (Pflicht)</span>
                <textarea
                  className="mt-1 min-h-24 w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
                  value={reopen.note}
                  onChange={(e) => setReopen((s) => ({ ...s, note: e.target.value }))}
                  placeholder="Warum wird die Bearbeitung wieder freigegeben?"
                />
              </label>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReopen({ open: false, year: maxYear, month: maxMonth, note: "" })}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={!reopen.note.trim() || isLoading}
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/hours/month/reopen", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          userId: forUserId,
                          year: reopen.year,
                          month: reopen.month,
                          note: reopen.note,
                        }),
                      });
                      if (!res.ok) throw new Error("reopen_failed");
                      setReopen({ open: false, year: maxYear, month: maxMonth, note: "" });
                      await loadTimesheets(forUserId, forUserName);
                    } catch {
                      window.alert("Freigabe fehlgeschlagen.");
                    }
                  }}
                  className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
                >
                  Freigeben
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[0_10px_24px_rgba(11,18,32,0.05)]">
          {[
            { key: "MEINE" as const, label: "Meine Stunden" },
            { key: "MITGLIEDER" as const, label: "Mitglieder" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setHoursView(t.key)}
              className={[
                "rounded-xl px-3 py-2 text-xs font-semibold transition",
                hoursView === t.key
                  ? "bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] text-[color:var(--foreground)]"
                  : "text-[color:var(--muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {hoursView === "MEINE" ? personalPanel : adminPanel}
    </div>
  );
}
