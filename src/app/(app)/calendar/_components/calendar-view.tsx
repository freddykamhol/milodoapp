"use client";

import * as React from "react";
import Link from "next/link";

type CalendarViewMode = "day" | "week" | "month";

type CalendarEvent = {
  appointmentId: number;
  startAt: string;
  endAt: string | null;
  title: string;
  einsatzort: string;
  customerName: string | null;
  bereich: string;
  dienstart: string | null;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMonday(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // Mon=0
  return addDays(d, -diff);
}

function startOfMonth(date: Date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function endOfMonth(date: Date) {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatRange(start: Date, end: Date | null) {
  if (!end) return formatTime(start);
  return `${formatTime(start)}–${formatTime(end)}`;
}

function toISO(date: Date) {
  return date.toISOString();
}

function buildWebcalUrl(path: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const httpsUrl = `${origin}${path}`;
  return httpsUrl.replace(/^https?:\/\//, "webcal://");
}

function CalendarActions({
  from,
  to,
}: {
  from: Date;
  to: Date;
}) {
  const [open, setOpen] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);

  const search = new URLSearchParams({ from: toISO(from), to: toISO(to) }).toString();
  const webcalPath = `/api/calendar/webcal`;
  const csvPath = `/api/calendar/confirmed/csv?${search}`;
  const pdfPath = `/api/calendar/confirmed/pdf?${search}`;

  const webcal = buildWebcalUrl(webcalPath);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.05)] transition hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]"
          aria-label="Kalender Aktionen"
        >
          Aktionen ▾
        </button>

        {open ? (
          <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowModal(true);
              }}
              className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-2)]"
            >
              Online-Kalender (webcal)
            </button>
            <a
              href={pdfPath}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
            >
              PDF-Export (Liste)
            </a>
            <a
              href={csvPath}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
            >
              CSV-Export
            </a>
          </div>
        ) : null}
      </div>

      {showModal ? (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold tracking-tight">Online-Kalender</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  Dauersynchroner, schreibgeschützter Kalender: externe Geräte können keine Termine bearbeiten.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Schließen
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <p className="text-xs font-semibold text-[color:var(--muted)]">webcal</p>
              <p className="mt-2 break-all font-mono text-xs">{webcal}</p>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Änderungen erfolgen nur in milodo und werden anschließend auf allen Geräten synchronisiert.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(webcal);
                    } catch {
                      window.alert("Kopieren fehlgeschlagen.");
                    }
                  }}
                >
                  1‑Klick Kopieren
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ViewSwitch({
  value,
  onChange,
}: {
  value: CalendarViewMode;
  onChange: (v: CalendarViewMode) => void;
}) {
  const items: Array<{ key: CalendarViewMode; label: string }> = [
    { key: "day", label: "Tag" },
    { key: "week", label: "Woche" },
    { key: "month", label: "Monat" },
  ];

  return (
    <div className="inline-flex overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_10px_24px_rgba(11,18,32,0.05)]">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={[
            "px-3 py-2 text-xs font-semibold",
            value === item.key
              ? "bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--foreground)]"
              : "text-[color:var(--muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function getRange(mode: CalendarViewMode, anchor: Date) {
  if (mode === "day") {
    const from = startOfDay(anchor);
    const to = addDays(from, 1);
    return { from, to };
  }

  if (mode === "week") {
    const from = startOfWeekMonday(anchor);
    const to = addDays(from, 7);
    return { from, to };
  }

  // month grid: start Monday of first week, end Sunday of last week
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeekMonday(monthStart);
  const monthEnd = endOfMonth(anchor);
  const gridEndExclusive = addDays(startOfWeekMonday(addDays(monthEnd, 6)), 7);
  return { from: gridStart, to: gridEndExclusive };
}

function groupByDay(events: CalendarEvent[]) {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const d = startOfDay(new Date(ev.startAt)).toISOString();
    const list = map.get(d) ?? [];
    list.push(ev);
    map.set(d, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  }
  return map;
}

export function CalendarView() {
  const [mode, setMode] = React.useState<CalendarViewMode>("month");
  const [anchor, setAnchor] = React.useState<Date>(() => new Date());

  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const { from, to } = React.useMemo(() => getRange(mode, anchor), [mode, anchor]);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setIsLoading(true);
      try {
        const search = new URLSearchParams({ from: toISO(from), to: toISO(to) });
        const res = await fetch(`/api/calendar/confirmed?${search.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("fetch_failed");
        const data = (await res.json()) as { events: CalendarEvent[] };
        if (!cancelled) setEvents(data.events ?? []);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const title = React.useMemo(() => {
    if (mode === "day") {
      return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" }).format(anchor);
    }
    if (mode === "week") {
      const w0 = startOfWeekMonday(anchor);
      const w6 = addDays(w0, 6);
      return `${formatDateLabel(w0)} – ${formatDateLabel(w6)}`;
    }
    return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(anchor);
  }, [mode, anchor]);

  const byDay = React.useMemo(() => groupByDay(events), [events]);

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]"
          >
            Heute
          </button>
          <button
            type="button"
            onClick={() => {
              setAnchor((prev) => {
                if (mode === "day") return addDays(prev, -1);
                if (mode === "week") return addDays(prev, -7);
                const d = new Date(prev);
                d.setMonth(d.getMonth() - 1);
                return d;
              });
            }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]"
            aria-label="Zurück"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => {
              setAnchor((prev) => {
                if (mode === "day") return addDays(prev, 1);
                if (mode === "week") return addDays(prev, 7);
                const d = new Date(prev);
                d.setMonth(d.getMonth() + 1);
                return d;
              });
            }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]"
            aria-label="Vor"
          >
            →
          </button>
          <ViewSwitch value={mode} onChange={setMode} />
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="text-sm font-semibold tracking-tight">{title}</p>
          <CalendarActions from={from} to={to} />
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="text-xs text-[color:var(--muted)]">Lade Termine…</p>
        ) : null}

        {mode === "month" ? (
          <MonthGrid from={from} to={to} byDay={byDay} />
        ) : mode === "week" ? (
          <WeekGrid anchor={anchor} byDay={byDay} />
        ) : (
          <DayList anchor={anchor} byDay={byDay} />
        )}
      </div>
    </div>
  );
}

function MonthGrid({
  from,
  to,
  byDay,
}: {
  from: Date;
  to: Date;
  byDay: Map<string, CalendarEvent[]>;
}) {
  const todayKey = startOfDay(new Date()).toISOString();
  const days: Date[] = [];
  for (let d = new Date(from); d < to; d = addDays(d, 1)) {
    days.push(new Date(d));
  }

  const monthLabel = new Intl.DateTimeFormat("de-DE", { month: "2-digit" }).format(addDays(from, 10));

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
      <div className="grid grid-cols-7 bg-[var(--surface-2)] text-[11px] font-semibold text-[color:var(--muted)]">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <div key={d} className="px-3 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 bg-[var(--surface)]">
        {days.map((date) => {
          const key = startOfDay(date).toISOString();
          const list = byDay.get(key) ?? [];
          const inMonth = new Intl.DateTimeFormat("de-DE", { month: "2-digit" }).format(date) === monthLabel;
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={[
                "min-h-28 border-t border-l border-[var(--border)] p-2",
                !inMonth ? "bg-[color:color-mix(in_oklab,var(--surface-2)_70%,transparent)]" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold",
                      isToday
                        ? "bg-[color:var(--accent)] text-white shadow-[0_10px_24px_color-mix(in_oklab,var(--accent)_35%,transparent)]"
                        : "bg-transparent text-[color:var(--foreground)]",
                    ].join(" ")}
                  >
                    {date.getDate()}
                  </span>
                  {isToday ? (
                    <span className="rounded-full bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent)]">
                      Heute
                    </span>
                  ) : null}
                </div>
                {list.length ? (
                  <span className="rounded-full bg-[color:color-mix(in_oklab,var(--accent)_18%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent)]">
                    {list.length}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {list.slice(0, 2).map((ev) => (
                  <Link
                    key={ev.appointmentId}
                    href={`/appointments/${ev.appointmentId}`}
                    className="rounded-xl bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] px-2 py-1 text-[11px] font-semibold leading-snug hover:underline"
                    title={ev.title}
                  >
                    <span className="block text-[color:var(--muted)]">
                      {formatTime(new Date(ev.startAt))}
                    </span>
                    <span className="line-clamp-1 block">{ev.title}</span>
                  </Link>
                ))}
                {list.length > 2 ? (
                  <p className="text-[11px] font-semibold text-[color:var(--muted)]">
                    +{list.length - 2} mehr
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  anchor,
  byDay,
}: {
  anchor: Date;
  byDay: Map<string, CalendarEvent[]>;
}) {
  const todayKey = startOfDay(new Date()).toISOString();
  const from = startOfWeekMonday(anchor);
  const days = Array.from({ length: 7 }).map((_, idx) => addDays(from, idx));

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
      <div className="grid grid-cols-7 bg-[var(--surface-2)] text-[11px] font-semibold text-[color:var(--muted)]">
        {days.map((d) => {
          const key = startOfDay(d).toISOString();
          const isToday = key === todayKey;
          return (
            <div
              key={d.toISOString()}
              className="px-3 py-2"
            >
              <span
                className={[
                  "inline-flex items-center rounded-full px-2 py-1",
                  isToday
                    ? "bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--accent)]"
                    : "",
                ].join(" ")}
              >
                {formatDateLabel(d)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 bg-[var(--surface)]">
        {days.map((date) => {
          const key = startOfDay(date).toISOString();
          const list = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={[
                "min-h-40 border-t border-l border-[var(--border)] p-2",
                isToday ? "relative" : "",
              ].join(" ")}
            >
              {isToday ? (
                <div className="mb-2 h-1 w-full rounded-full bg-[color:var(--accent)]" />
              ) : null}
              <div className="flex flex-col gap-1">
                {list.length ? (
                  list.map((ev) => (
                    <Link
                      key={ev.appointmentId}
                      href={`/appointments/${ev.appointmentId}`}
                      title={`${ev.title} • ${ev.customerName ?? ""} ${ev.einsatzort}`}
                      className="block rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[11px] font-semibold leading-snug hover:bg-[var(--surface)]"
                    >
                      <span className="text-[color:var(--muted)]">
                        {formatRange(new Date(ev.startAt), ev.endAt ? new Date(ev.endAt) : null)}
                      </span>
                      <span className="mt-0.5 block whitespace-normal break-words">{ev.title}</span>
                      <span className="mt-0.5 block text-[10px] font-medium text-[color:var(--muted)]">
                        {ev.customerName ? `${ev.customerName} • ` : ""}
                        {ev.einsatzort}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-[11px] font-semibold text-[color:var(--muted)]">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayList({
  anchor,
  byDay,
}: {
  anchor: Date;
  byDay: Map<string, CalendarEvent[]>;
}) {
  const key = startOfDay(anchor).toISOString();
  const list = byDay.get(key) ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]">
        Termine (zugesagt)
      </div>
      <div className="divide-y divide-[var(--border)]">
        {list.length ? (
          list.map((ev) => (
            <Link
              key={ev.appointmentId}
              href={`/appointments/${ev.appointmentId}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--surface-2)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{ev.title}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                  {ev.customerName ? `${ev.customerName} • ` : ""}
                  {ev.einsatzort}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-[color:var(--muted)]">
                  {formatRange(new Date(ev.startAt), ev.endAt ? new Date(ev.endAt) : null)}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-[color:var(--muted)]">Keine zugesagten Termine.</p>
        )}
      </div>
    </div>
  );
}
