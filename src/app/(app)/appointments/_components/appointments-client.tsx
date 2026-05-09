"use client";

import * as React from "react";
import Link from "next/link";

import { type BadgeTone, Badge } from "../../_components/ui";
import { AppointmentContextMenu } from "../../dashboard/_components/appointment-context-menu";

type FilterKey = "all" | "open" | "staffed" | "reported" | "confirmed" | "cancelled";
type RangeKey = "1m" | "3m" | "12m" | "future";

export type AppointmentFeedItem = {
  id: number;
  startAt: string;
  endAt: string | null;
  title: string;
  einsatzort: string;
  customerName: string | null;
  bereich: string;
  dienstart: string | null;
  state: string;
  staffingStatus: string;
  applicationStatus: string | null;
  isAcute: boolean;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatTimeRange(startAt: Date, endAt: Date | null) {
  if (!endAt) return formatTime(startAt);
  return `${formatTime(startAt)}–${formatTime(endAt)}`;
}

function filterLabel(key: FilterKey) {
  if (key === "all") return "Alle";
  if (key === "open") return "Offen";
  if (key === "staffed") return "Bereits besetzt";
  if (key === "reported") return "Gemeldet";
  if (key === "confirmed") return "Eingeteilt";
  return "Abgesagt";
}

export function AppointmentsClient({
  initialFilter = "open",
  initialRange = "future",
  initialItems,
  initialCursor,
  counts,
  canCreate,
}: {
  initialFilter?: FilterKey;
  initialRange?: RangeKey;
  initialItems: AppointmentFeedItem[];
  initialCursor: string | null;
  counts: { open: number; staffed: number; reported: number; confirmed: number; cancelled: number };
  canCreate: boolean;
}) {
  const [filter, setFilter] = React.useState<FilterKey>(initialFilter);
  const [range, setRange] = React.useState<RangeKey>(initialRange);
  const [items, setItems] = React.useState<AppointmentFeedItem[]>(initialItems);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(Boolean(initialCursor));

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(
    async ({
      reset,
      nextFilter,
      nextRange,
    }: {
      reset: boolean;
      nextFilter: FilterKey;
      nextRange: RangeKey;
    }) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          filter: nextFilter,
          range: nextRange,
          limit: "10",
        });
        const c = reset ? null : cursor;
        if (c) params.set("cursor", c);

        const res = await fetch(`/api/appointments/feed?${params.toString()}`, { method: "GET" });
        if (!res.ok) throw new Error("feed_failed");
        const data = (await res.json()) as { events: AppointmentFeedItem[]; nextCursor: string | null };

        setItems((prev) => (reset ? data.events : [...prev, ...data.events]));
        setCursor(data.nextCursor);
        setHasMore(Boolean(data.nextCursor));
      } catch {
        if (reset) {
          setItems([]);
          setCursor(null);
          setHasMore(false);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [cursor, isLoading],
  );

  const selectFilter = (nextFilter: FilterKey) => {
    setFilter(nextFilter);
    setCursor(null);
    setHasMore(true);
    void load({ reset: true, nextFilter, nextRange: range });
  };

  const selectRange = (nextRange: RangeKey) => {
    setRange(nextRange);
    setCursor(null);
    setHasMore(true);
    void load({ reset: true, nextFilter: filter, nextRange });
  };

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        void load({ reset: false, nextFilter: filter, nextRange: range });
      },
      { root: null, rootMargin: "600px", threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [filter, range, hasMore, load]);

  const tabs: Array<{ key: FilterKey; count: number }> = [
    { key: "all", count: counts.open + counts.staffed + counts.reported + counts.confirmed + counts.cancelled },
    { key: "open", count: counts.open },
    { key: "staffed", count: counts.staffed },
    { key: "reported", count: counts.reported },
    { key: "confirmed", count: counts.confirmed },
    { key: "cancelled", count: counts.cancelled },
  ];

  const ranges: Array<{ key: RangeKey; label: string }> = [
    { key: "1m", label: "1 Monat" },
    { key: "3m", label: "3 Monate" },
    { key: "12m", label: "12 Monate" },
    { key: "future", label: "Alle zukünftigen" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectFilter(t.key)}
              className={[
                "inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-semibold shadow-[0_10px_24px_rgba(11,18,32,0.05)]",
                filter === t.key
                  ? "bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--foreground)]"
                  : "bg-[var(--surface)] text-[color:var(--muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              {filterLabel(t.key)}
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--muted)]">
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {canCreate ? (
          <Link
            href="/appointments/new"
            className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
          >
            Termin erstellen
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ranges.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => selectRange(r.key)}
            className={[
              "rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-semibold shadow-[0_10px_24px_rgba(11,18,32,0.05)]",
              range === r.key
                ? "bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] text-[color:var(--foreground)]"
                : "bg-[var(--surface)] text-[color:var(--muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="min-w-[860px] grid grid-cols-[150px_1fr_220px_110px_44px] gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]">
          <div>Datum/Zeit</div>
          <div>Titel</div>
          <div>Ort</div>
          <div>Status</div>
          <div className="text-right">Aktion</div>
        </div>

        <ul className="min-w-[860px] divide-y divide-[var(--border)]">
          {items.map((item) => {
            const start = new Date(item.startAt);
            const end = item.endAt ? new Date(item.endAt) : null;
            const isCancelled = item.state === "CANCELLED" || item.applicationStatus === "CANCELLED";
            const isConfirmed = item.applicationStatus === "CONFIRMED";
            const isReported = item.applicationStatus === "REPORTED";
            const isStaffed = item.staffingStatus === "BESETZT";

            const needsStaffing =
              item.staffingStatus === "UNBESETZT" || item.staffingStatus === "UNTERBESETZT";
            const highlightAcute = item.isAcute && needsStaffing && !isCancelled && !isConfirmed;

            const variant = isConfirmed ? "confirmed" : "open";

            const statusTone: BadgeTone = isCancelled
              ? "danger"
              : isConfirmed
                ? "success"
                : isReported
                  ? "warning"
                  : "accent";

            const statusLabel = isCancelled
              ? "ABGESAGT"
              : isConfirmed
                ? "EINGETEILT"
                : isReported
                  ? "GEMELDET"
                  : item.staffingStatus;

            return (
              <li
                key={item.id}
                className={[
                  "grid grid-cols-[150px_1fr_220px_110px_44px] items-center gap-3 px-4 py-3",
                  highlightAcute
                    ? "bg-[color:color-mix(in_oklab,var(--danger)_6%,transparent)] outline outline-1 outline-[color:color-mix(in_oklab,var(--danger)_40%,transparent)]"
                    : "",
                ].join(" ")}
              >
                <div className="text-xs font-semibold text-[color:var(--muted)]">
                  <div className="truncate">{formatDate(start)}</div>
                  <div className="mt-0.5 text-[11px] font-medium">
                    {formatTimeRange(start, end)}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                    {item.customerName ? `${item.customerName} • ` : ""}
                    {item.dienstart ? `${item.dienstart} • ` : ""}
                    {item.bereich}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.einsatzort}</p>
                </div>
                <div>
                  <Badge tone={statusTone}>{statusLabel}</Badge>
                </div>
                <div className="flex justify-end">
                  <AppointmentContextMenu
                    appointmentId={item.id}
                    variant={variant}
                    canManage={canCreate}
                    canReport={!isStaffed}
                    canTriggerInquiry={canCreate}
                    canTriggerAcuteInquiry={canCreate && item.isAcute}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {items.length === 0 && !isLoading ? (
          <p className="px-4 py-6 text-sm text-[color:var(--muted)]">Keine Termine gefunden.</p>
        ) : null}

        <div ref={sentinelRef} className="h-10" />

        {isLoading ? (
          <p className="px-4 pb-4 text-xs font-semibold text-[color:var(--muted)]">Lade…</p>
        ) : null}
      </div>
    </div>
  );
}
