"use client";

import * as React from "react";
import Link from "next/link";

import { Badge } from "./ui";

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatTimeRange(startAt: Date, endAt: Date | null) {
  if (!endAt) return formatTime(startAt);
  return `${formatTime(startAt)}–${formatTime(endAt)}`;
}

type Item = { id: number; startAt: string; endAt: string | null; title: string; einsatzort: string };

export function TodayInView() {
  const [data, setData] = React.useState<{
    confirmed: Item[];
    birthdays: Array<{ id: number; username: string }>;
    requests: Item[];
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/today", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok: boolean;
          today?: {
            confirmed: Item[];
            birthdays: Array<{ id: number; username: string }>;
            requests: Item[];
          };
        };
        if (!json.ok || !json.today) return;
        if (cancelled) return;
        setData(json.today);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmed = data?.confirmed ?? [];
  const birthdays = data?.birthdays ?? [];
  const requests = data?.requests ?? [];

  return (
    <div className="mt-5 rounded-2xl bg-[var(--surface-2)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">Heute im Blick</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">Heutige Termine, Geburtstage und Abfragen.</p>
        </div>
        <Badge tone="muted">{new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date())}</Badge>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[color:var(--muted)]">Heutige Termine</p>
            <Badge tone={confirmed.length ? "success" : "muted"}>{confirmed.length}</Badge>
          </div>
          {confirmed.length ? (
            <ul className="mt-2 space-y-1.5">
              {confirmed.slice(0, 3).map((t) => {
                const s = new Date(t.startAt);
                const e = t.endAt ? new Date(t.endAt) : null;
                return (
                  <li key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <Link href={`/appointments/${t.id}`} className="block">
                      <p className="truncate text-xs font-semibold">{t.title}</p>
                      <p className="mt-1 truncate text-[11px] font-medium text-[color:var(--muted)]">
                        {formatTimeRange(s, e)} • {t.einsatzort}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] font-medium text-[color:var(--muted)]">Keine Termine heute.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[color:var(--muted)]">Geburtstage</p>
            <Badge tone={birthdays.length ? "warning" : "muted"}>{birthdays.length}</Badge>
          </div>
          {birthdays.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {birthdays.slice(0, 6).map((b) => (
                <Badge key={b.id} tone="warning">
                  {b.username}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] font-medium text-[color:var(--muted)]">Niemand hat heute Geburtstag.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[color:var(--muted)]">Aktuelle Dienstabfragen</p>
            <Badge tone={requests.length ? "accent" : "muted"}>{requests.length}</Badge>
          </div>
          {requests.length ? (
            <ul className="mt-2 space-y-1.5">
              {requests.slice(0, 3).map((t) => {
                const s = new Date(t.startAt);
                const e = t.endAt ? new Date(t.endAt) : null;
                return (
                  <li key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <Link href={`/appointments/${t.id}`} className="block">
                      <p className="truncate text-xs font-semibold">{t.title}</p>
                      <p className="mt-1 truncate text-[11px] font-medium text-[color:var(--muted)]">
                        {formatTimeRange(s, e)} • {t.einsatzort}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] font-medium text-[color:var(--muted)]">Keine Abfragen heute.</p>
          )}
        </div>
      </div>
    </div>
  );
}
