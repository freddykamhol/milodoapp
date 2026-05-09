"use client";

import * as React from "react";

import { ResponsiveGridLayout, useContainerWidth, verticalCompactor, type LayoutItem } from "react-grid-layout";

import { IconPencil } from "../../../_components/icons";
import { Badge, Card, Kpi } from "../../../_components/ui";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type StatsData = {
  kpis: {
    openFutureTotal: number;
    occupancyPercent: number;
    confirmedNext90: number;
    reportedNext90: number;
    minutesThisMonth: number;
    minutesLastMonth: number;
  };
  occupancy: {
    openBesetzt: number;
    openUnterbesetzt: number;
    openUnbesetzt: number;
  };
  next90ByType: Array<{ dienstart: string | null; count: number }>;
  timesheets: {
    year: number;
    month: number;
    closedThisMonth: number;
    openThisMonth: number;
    membersCount: number;
    completionPercent: number;
  };
  last6: Array<{ year: number; month: number; minutes: number }>;
  next7Days: Array<{ day: string; count: number }>;
  topCustomers: Array<{ name: string; count: number }>;
  master: { membersCount: number; customersCount: number; documentsCount: number };
};

type Layout = LayoutItem[];
type Layouts = Record<string, Layout>;

function minutesLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function percentLabel(n: number) {
  return `${Math.round(n)}%`;
}

function monthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function defaultLayouts(): Layouts {
  const lg: LayoutItem[] = [
    { i: "kpi-open", x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: "kpi-confirmed", x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: "kpi-reported", x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: "occ", x: 0, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
    { i: "types", x: 4, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
    { i: "timesheets", x: 8, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
    { i: "hours6", x: 0, y: 7, w: 6, h: 6, minW: 4, minH: 5 },
    { i: "next7", x: 6, y: 7, w: 6, h: 6, minW: 4, minH: 5 },
    { i: "top", x: 0, y: 13, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "master", x: 6, y: 13, w: 6, h: 5, minW: 4, minH: 4 },
  ];

  const md: LayoutItem[] = [
    { i: "kpi-open", x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: "kpi-confirmed", x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: "kpi-reported", x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: "occ", x: 0, y: 2, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "types", x: 6, y: 2, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "timesheets", x: 0, y: 7, w: 12, h: 5, minW: 6, minH: 4 },
    { i: "hours6", x: 0, y: 12, w: 12, h: 6, minW: 6, minH: 5 },
    { i: "next7", x: 0, y: 18, w: 12, h: 6, minW: 6, minH: 5 },
    { i: "top", x: 0, y: 24, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "master", x: 6, y: 24, w: 6, h: 5, minW: 4, minH: 4 },
  ];

  const sm: LayoutItem[] = [
    { i: "kpi-open", x: 0, y: 0, w: 2, h: 2 },
    { i: "kpi-confirmed", x: 2, y: 0, w: 2, h: 2 },
    { i: "kpi-reported", x: 4, y: 0, w: 2, h: 2 },
    { i: "occ", x: 0, y: 2, w: 3, h: 5, minH: 4 },
    { i: "types", x: 3, y: 2, w: 3, h: 5, minH: 4 },
    { i: "timesheets", x: 0, y: 7, w: 6, h: 5, minH: 4 },
    { i: "hours6", x: 0, y: 12, w: 6, h: 6, minH: 5 },
    { i: "next7", x: 0, y: 18, w: 6, h: 6, minH: 5 },
    { i: "top", x: 0, y: 24, w: 6, h: 5, minH: 4 },
    { i: "master", x: 0, y: 29, w: 6, h: 5, minH: 4 },
  ];

  const xs: LayoutItem[] = [
    { i: "kpi-open", x: 0, y: 0, w: 2, h: 2 },
    { i: "kpi-confirmed", x: 0, y: 2, w: 2, h: 2 },
    { i: "kpi-reported", x: 0, y: 4, w: 2, h: 2 },
    { i: "occ", x: 0, y: 6, w: 2, h: 4 },
    { i: "types", x: 0, y: 10, w: 2, h: 4 },
    { i: "timesheets", x: 0, y: 14, w: 2, h: 4 },
    { i: "hours6", x: 0, y: 18, w: 2, h: 6 },
    { i: "next7", x: 0, y: 24, w: 2, h: 5 },
    { i: "top", x: 0, y: 29, w: 2, h: 4 },
    { i: "master", x: 0, y: 33, w: 2, h: 4 },
  ];

  const xxs: LayoutItem[] = [
    { i: "kpi-open", x: 0, y: 0, w: 2, h: 2 },
    { i: "kpi-confirmed", x: 0, y: 2, w: 2, h: 2 },
    { i: "kpi-reported", x: 0, y: 4, w: 2, h: 2 },
    { i: "occ", x: 0, y: 8, w: 2, h: 4 },
    { i: "types", x: 0, y: 12, w: 2, h: 4 },
    { i: "timesheets", x: 0, y: 16, w: 2, h: 4 },
    { i: "hours6", x: 0, y: 20, w: 2, h: 6 },
    { i: "next7", x: 0, y: 26, w: 2, h: 5 },
    { i: "top", x: 0, y: 31, w: 2, h: 4 },
    { i: "master", x: 0, y: 35, w: 2, h: 4 },
  ];

  return { lg, md, sm, xs, xxs };
}

function cloneLayouts(input: Layouts): Layouts {
  return Object.fromEntries(
    Object.entries(input).map(([bp, layout]) => [
      bp,
      (layout ?? []).map((i) => ({ ...i })),
    ]),
  ) as Layouts;
}

function DragHandle() {
  return (
    <div
      className="drag-handle grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[color:var(--muted)] hover:bg-[var(--surface-2)]"
      aria-label="Verschieben"
      title="Verschieben"
    >
      <span className="text-sm font-semibold leading-none">⋮⋮</span>
    </div>
  );
}

export function StatsGridClient({ data }: { data: StatsData }) {
  const storageKey = "milodo:stats-layouts:v5";
  const defaults = React.useMemo(() => defaultLayouts(), []);

  const [savedLayouts, setSavedLayouts] = React.useState<Layouts>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Layouts;
      const required = new Set([
        "kpi-open",
        "kpi-confirmed",
        "kpi-reported",
        "occ",
        "types",
        "timesheets",
        "hours6",
        "next7",
        "top",
        "master",
      ]);
      const presentLg = new Set((parsed?.lg ?? []).map((i) => i.i));
      const isValid = parsed?.lg && Array.from(required).every((k) => presentLg.has(k));
      if (!isValid) return defaults;
      return cloneLayouts(parsed);
    } catch {
      return defaults;
    }
  });

  const [draftLayouts, setDraftLayouts] = React.useState<Layouts>(() => cloneLayouts(savedLayouts));
  const [isEditing, setIsEditing] = React.useState(false);
  const [resetToken, setResetToken] = React.useState(0);

  function persist(next: Layouts) {
    setSavedLayouts(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  const { width, containerRef, mounted } = useContainerWidth();

  return (
    <div
      ref={containerRef}
      className={["stats-grid-wrap w-full min-w-0 overflow-visible", isEditing ? "is-editing" : ""].join(" ")}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Statistiken-Layout</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">Karten anordnen und Größe anpassen.</p>
        </div>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => {
              setDraftLayouts(cloneLayouts(savedLayouts));
              setIsEditing(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
          >
            <IconPencil className="h-4 w-4" />
            <span className="hidden sm:inline">Bearbeiten</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftLayouts(cloneLayouts(defaults));
                setResetToken((v) => v + 1);
              }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftLayouts(cloneLayouts(savedLayouts));
                setIsEditing(false);
              }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                persist(draftLayouts);
                setIsEditing(false);
              }}
              className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
            >
              Speichern
            </button>
          </div>
        )}
      </div>
      {mounted ? (
        <ResponsiveGridLayout
          key={resetToken}
          width={width}
          className="stats-grid"
          layouts={isEditing ? draftLayouts : savedLayouts}
          breakpoints={{ lg: 1200, md: 860, sm: 640, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 2, xxs: 2 }}
          rowHeight={60}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          autoSize
          compactor={verticalCompactor}
          dragConfig={{ enabled: isEditing, handle: ".drag-handle", threshold: 4, bounded: true }}
          resizeConfig={{ enabled: isEditing, handles: ["se"] }}
          onLayoutChange={(_current, all) => {
            if (isEditing) setDraftLayouts(all as unknown as Layouts);
          }}
        >
        <div key="kpi-open">
          <Card className="relative h-full overflow-hidden p-5">
            {isEditing ? (
              <div className="absolute right-3 top-3">
                <DragHandle />
              </div>
            ) : null}
            <Kpi
              label="Offene Dienste (zukünftig)"
              value={String(data.kpis.openFutureTotal)}
              change={`${percentLabel(data.kpis.occupancyPercent)} besetzt`}
              tone={data.kpis.occupancyPercent >= 80 ? "success" : data.kpis.occupancyPercent >= 50 ? "warning" : "danger"}
            />
          </Card>
        </div>

        <div key="kpi-confirmed">
          <Card className="relative h-full overflow-hidden p-5">
            {isEditing ? (
              <div className="absolute right-3 top-3">
                <DragHandle />
              </div>
            ) : null}
            <Kpi
              label="Zugesagt (nächste 90 Tage)"
              value={String(data.kpis.confirmedNext90)}
              change="CONFIRMED"
              tone="accent"
            />
          </Card>
        </div>

        <div key="kpi-reported">
          <Card className="relative h-full overflow-hidden p-5">
            {isEditing ? (
              <div className="absolute right-3 top-3">
                <DragHandle />
              </div>
            ) : null}
            <Kpi
              label="Gemeldet (nächste 90 Tage)"
              value={String(data.kpis.reportedNext90)}
              change="REPORTED"
              tone="warning"
            />
          </Card>
        </div>

        <div key="occ">
          <Card
            className="h-full overflow-hidden"
            title="Besetzung (zukünftige offene Dienste)"
            description="Status nach Personalansatz / Besetzungsgrad."
            actions={
              <div className="flex items-center gap-2">
                <Badge tone="muted">Live</Badge>
                {isEditing ? <DragHandle /> : null}
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Besetzt", value: data.occupancy.openBesetzt, tone: "success" as const },
                { label: "Unterbesetzt", value: data.occupancy.openUnterbesetzt, tone: "warning" as const },
                { label: "Unbesetzt", value: data.occupancy.openUnbesetzt, tone: "danger" as const },
              ].map((i) => (
                <div key={i.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <p className="text-xs font-semibold text-[color:var(--muted)]">{i.label}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="text-xl font-semibold tracking-tight">{i.value}</p>
                    <Badge tone={i.tone}>{i.label}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div key="types">
          <Card
            className="h-full overflow-hidden"
            title="Dienstart (nächste 90 Tage)"
            description="Verteilung nach KTW/RTW/NEF/…"
            actions={
              <div className="flex items-center gap-2">
                <Badge tone="muted">90 Tage</Badge>
                {isEditing ? <DragHandle /> : null}
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              {data.next90ByType.length ? (
                data.next90ByType.map((r) => (
                  <div
                    key={r.dienstart ?? "—"}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.dienstart ?? "—"}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">Termine</p>
                    </div>
                    <Badge tone="accent">{r.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[color:var(--muted)]">Keine Daten.</p>
              )}
            </div>
          </Card>
        </div>

        <div key="timesheets">
          <Card
            className="h-full overflow-hidden"
            title="Monatsabschlüsse (aktueller Monat)"
            description="Wie viele Stundenzettel sind abgeschlossen?"
            actions={
              <div className="flex items-center gap-2">
                <Badge tone="muted">{monthTitle(data.timesheets.year, data.timesheets.month)}</Badge>
                {isEditing ? <DragHandle /> : null}
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <p className="text-xs font-semibold text-[color:var(--muted)]">Abgeschlossen</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-xl font-semibold tracking-tight">{data.timesheets.closedThisMonth}</p>
                  <Badge tone="success">{percentLabel(data.timesheets.completionPercent)}</Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <p className="text-xs font-semibold text-[color:var(--muted)]">Offen</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-xl font-semibold tracking-tight">{data.timesheets.openThisMonth}</p>
                  <Badge tone="warning">{data.timesheets.membersCount} Mitglieder</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div key="hours6">
          <Card
            className="h-full overflow-hidden"
            title="Stunden"
            description="Aktueller Monat + Verlauf (letzte 6 Monate)."
            actions={isEditing ? <DragHandle /> : null}
          >
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <Kpi
                  label="Stunden (aktueller Monat)"
                  value={minutesLabel(data.kpis.minutesThisMonth)}
                  change={`Vormonat ${minutesLabel(data.kpis.minutesLastMonth)}`}
                  tone={data.kpis.minutesThisMonth >= data.kpis.minutesLastMonth ? "success" : "warning"}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {(() => {
                  const max = Math.max(1, ...data.last6.map((m) => m.minutes));
                  return data.last6.map((m) => {
                    const h = Math.max(8, Math.round((m.minutes / max) * 120));
                    return (
                      <div key={monthKey(m.year, m.month)} className="flex min-w-0 flex-col items-center gap-2">
                        <div className="flex h-[140px] w-full min-w-0 items-end rounded-2xl bg-[var(--surface-2)] p-2">
                          <div
                            className="w-full rounded-xl bg-[color:var(--accent)]"
                            style={{ height: `${h}px` }}
                            aria-label={`${monthTitle(m.year, m.month)} ${minutesLabel(m.minutes)}`}
                          />
                        </div>
                        <p className="text-[11px] font-semibold text-[color:var(--muted)]">{monthTitle(m.year, m.month)}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </Card>
        </div>

        <div key="next7">
          <Card
            className="h-full overflow-hidden"
            title="Nächste 7 Tage"
            description="Anzahl Dienste pro Tag."
            actions={isEditing ? <DragHandle /> : null}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.next7Days.length ? (
                data.next7Days.map((r) => (
                  <div
                    key={r.day}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <p className="text-sm font-semibold">
                      {new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(
                        new Date(`${r.day}T00:00:00`),
                      )}
                    </p>
                    <Badge tone="accent">{r.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[color:var(--muted)]">Keine Daten.</p>
              )}
            </div>
          </Card>
        </div>

        <div key="top">
          <Card
            className="h-full overflow-hidden"
            title="Top Kunden (letzte 30 Tage)"
            description="Welche Kunden hatten die meisten Dienste?"
            actions={isEditing ? <DragHandle /> : null}
          >
            <div className="flex flex-col gap-2">
              {data.topCustomers.length ? (
                data.topCustomers.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <Badge tone="muted">{c.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[color:var(--muted)]">Keine Daten.</p>
              )}
            </div>
          </Card>
        </div>

        <div key="master">
          <Card
            className="h-full overflow-hidden"
            title="Stammdaten"
            description="Kernzahlen aus dem System."
            actions={isEditing ? <DragHandle /> : null}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Mitglieder", value: data.master.membersCount },
                { label: "Kunden", value: data.master.customersCount },
                { label: "Dokumente", value: data.master.documentsCount },
              ].map((i) => (
                <div key={i.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <p className="text-xs font-semibold text-[color:var(--muted)]">{i.label}</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{i.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        </ResponsiveGridLayout>
      ) : null}
    </div>
  );
}
