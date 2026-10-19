"use client";

import { dateFormatter } from "@/lib/date-format";
import * as React from "react";
import Link from "next/link";
import { type BadgeTone, Badge, Card } from "../../_components/ui";
import { AppointmentContextMenu } from "../../dashboard/_components/appointment-context-menu";
import { serviceAreaLabel } from "@/lib/service-area-label";

type FilterKey = "all" | "open" | "staffed" | "reported" | "confirmed" | "cancelled";
type RangeKey = "1m" | "3m" | "12m" | "future";
export type AppointmentFeedItem = { id: number; startAt: string; endAt: string | null; title: string; einsatzort: string; customerName: string | null; bereich: string; dienstart: string | null; state: string; staffingStatus: string; applicationStatus: string | null; isAcute: boolean };

function formatDate(date: Date) { return dateFormatter({ weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function formatTime(date: Date) { return dateFormatter({ hour: "2-digit", minute: "2-digit" }).format(date); }
function formatTimeRange(startAt: Date, endAt: Date | null) { return endAt ? `${formatTime(startAt)}–${formatTime(endAt)}` : formatTime(startAt); }
function filterLabel(key: FilterKey) { return key === "all" ? "Alle" : key === "open" ? "Offen" : key === "staffed" ? "Bereits besetzt" : key === "reported" ? "Gemeldet" : key === "confirmed" ? "Eingeteilt" : "Abgesagt"; }

export function AppointmentsClient({ initialFilter = "open", initialRange = "future", initialItems, initialCursor, counts, canCreate }: { initialFilter?: FilterKey; initialRange?: RangeKey; initialItems: AppointmentFeedItem[]; initialCursor: string | null; counts: { open: number; staffed: number; reported: number; confirmed: number; cancelled: number }; canCreate: boolean }) {
  const [filter, setFilter] = React.useState<FilterKey>(initialFilter);
  const [range, setRange] = React.useState<RangeKey>(initialRange);
  const [items, setItems] = React.useState<AppointmentFeedItem[]>(initialItems);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(Boolean(initialCursor));
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async ({ reset, nextFilter, nextRange }: { reset: boolean; nextFilter: FilterKey; nextRange: RangeKey }) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ filter: nextFilter, range: nextRange, limit: "10" });
      const nextCursor = reset ? null : cursor;
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/appointments/feed?${params.toString()}`);
      if (!res.ok) throw new Error("feed_failed");
      const data = (await res.json()) as { events: AppointmentFeedItem[]; nextCursor: string | null };
      setItems((prev) => reset ? data.events : [...prev, ...data.events]);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch {
      if (reset) { setItems([]); setCursor(null); setHasMore(false); }
    } finally { setIsLoading(false); }
  }, [cursor, isLoading]);

  const selectFilter = (nextFilter: FilterKey) => { setFilter(nextFilter); setCursor(null); setHasMore(true); void load({ reset: true, nextFilter, nextRange: range }); };
  const selectRange = (nextRange: RangeKey) => { setRange(nextRange); setCursor(null); setHasMore(true); void load({ reset: true, nextFilter: filter, nextRange }); };

  React.useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void load({ reset: false, nextFilter: filter, nextRange: range }); }, { rootMargin: "600px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [filter, range, hasMore, load]);

  const tabs: Array<{ key: FilterKey; count: number }> = [
    { key: "all", count: counts.open + counts.staffed + counts.reported + counts.confirmed + counts.cancelled },
    { key: "open", count: counts.open }, { key: "staffed", count: counts.staffed }, { key: "reported", count: counts.reported }, { key: "confirmed", count: counts.confirmed }, { key: "cancelled", count: counts.cancelled },
  ];
  const ranges: Array<{ key: RangeKey; label: string }> = [{ key: "1m", label: "1 Monat" }, { key: "3m", label: "3 Monate" }, { key: "12m", label: "12 Monate" }, { key: "future", label: "Alle zukünftigen" }];

  return <div className="flex flex-col gap-4">
    <Card><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => selectFilter(tab.key)} className={["inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-semibold", filter === tab.key ? "bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--foreground)]" : "bg-[var(--surface)] text-[color:var(--muted)] hover:bg-[var(--surface-2)]"].join(" ")}>{filterLabel(tab.key)}<span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px]">{tab.count}</span></button>)}</div>{canCreate ? <Link href="/appointments/new" className="ui-button-primary">Termin erstellen</Link> : null}</div><div className="mt-3 flex flex-wrap gap-2">{ranges.map((item) => <button key={item.key} type="button" onClick={() => selectRange(item.key)} className={["rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-semibold", range === item.key ? "bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] text-[color:var(--foreground)]" : "bg-[var(--surface)] text-[color:var(--muted)] hover:bg-[var(--surface-2)]"].join(" ")}>{item.label}</button>)}</div></Card>
    <Card><div className="space-y-3">{items.map((item) => {
      const start = new Date(item.startAt), end = item.endAt ? new Date(item.endAt) : null;
      const isCancelled = item.state === "CANCELLED" || item.applicationStatus === "CANCELLED";
      const isConfirmed = item.applicationStatus === "CONFIRMED";
      const isReported = item.applicationStatus === "REPORTED";
      const isStaffed = item.staffingStatus === "BESETZT";
      const needsStaffing = item.staffingStatus === "UNBESETZT" || item.staffingStatus === "UNTERBESETZT";
      const statusTone: BadgeTone = isCancelled ? "danger" : isConfirmed ? "success" : isReported ? "warning" : "accent";
      const statusLabel = isCancelled ? "ABGESAGT" : isConfirmed ? "EINGETEILT" : isReported ? "GEMELDET" : item.staffingStatus;
      return <article key={item.id} className={["rounded-2xl border border-[var(--border)] p-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]", item.isAcute && needsStaffing && !isCancelled && !isConfirmed ? "border-[color:color-mix(in_oklab,var(--danger)_45%,var(--border))] bg-[color:color-mix(in_oklab,var(--danger)_5%,transparent)]" : ""].join(" ")}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link href={`/appointments/${item.id}`} className="break-words font-semibold hover:text-[color:var(--accent)]">{item.title}</Link><p className="mt-1 break-words text-sm text-[color:var(--muted)]">{item.customerName ? `${item.customerName} · ` : ""}{item.dienstart ? `${item.dienstart} · ` : ""}{serviceAreaLabel(item.bereich)}</p></div><div className="flex items-center gap-2"><Badge tone={statusTone}>{statusLabel}</Badge><AppointmentContextMenu appointmentId={item.id} variant={isConfirmed ? "confirmed" : "open"} canManage={canCreate} canReport={!isStaffed} canTriggerInquiry={canCreate} canTriggerAcuteInquiry={canCreate && item.isAcute} /></div></div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs font-semibold text-[color:var(--muted)]">Datum / Zeit</p><p className="mt-1 font-semibold">{formatDate(start)} · {formatTimeRange(start, end)}</p></div><div><p className="text-xs font-semibold text-[color:var(--muted)]">Ort</p><p className="mt-1 break-words font-semibold">{item.einsatzort}</p></div><div><p className="text-xs font-semibold text-[color:var(--muted)]">Besetzung</p><p className="mt-1 font-semibold">{item.staffingStatus}</p></div><div><p className="text-xs font-semibold text-[color:var(--muted)]">Status</p><p className="mt-1 font-semibold">{statusLabel}</p></div></div>
      </article>;
    })}</div>{items.length === 0 && !isLoading ? <p className="px-2 py-6 text-sm text-[color:var(--muted)]">Keine Termine gefunden.</p> : null}<div ref={sentinelRef} className="h-10" />{isLoading ? <p className="px-2 pb-4 text-xs font-semibold text-[color:var(--muted)]">Lade …</p> : null}</Card>
  </div>;
}
