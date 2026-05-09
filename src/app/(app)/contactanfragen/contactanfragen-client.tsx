"use client";

import * as React from "react";
import Link from "next/link";

type Item = {
  id: number;
  createdAt: number;
  status: "NEW" | "DONE";
  mode: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  sourceUrl: string;
  readAt: number | null;
  ip: string;
};

type Sort = "newest" | "oldest";

function statusLabel(status: "NEW" | "DONE") {
  return status === "DONE" ? "ERLEDIGT" : "NEU";
}

function modeLabel(mode: string) {
  const m = (mode || "").toLowerCase();
  if (m === "eh") return "EH-Ausbildung";
  if (m === "sanitaet") return "Sanitätsdienst";
  if (m === "boerse") return "Personal (Börse)";
  return "Kontakt";
}

function modeBadgeClass(mode: string) {
  const m = (mode || "").toLowerCase();
  if (m === "eh") return "bg-emerald-600";
  if (m === "sanitaet") return "bg-indigo-600";
  if (m === "boerse") return "bg-amber-600";
  return "bg-zinc-700";
}

function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function ContactAnfragenClient() {
  const [mode, setMode] = React.useState<string>("");
  const [days, setDays] = React.useState<string>("30");
  const [sort, setSort] = React.useState<Sort>("newest");
  const [unread, setUnread] = React.useState<string>("1");
  const [q, setQ] = React.useState("");

  const qDebounced = useDebouncedValue(q, 250);

  const [items, setItems] = React.useState<Item[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const url = new URL("/api/contact-inquiries", window.location.origin);
      if (mode) url.searchParams.set("mode", mode);
      if (days) url.searchParams.set("days", days);
      url.searchParams.set("sort", sort);
      if (unread) url.searchParams.set("unread", unread);
      if (qDebounced.trim()) url.searchParams.set("q", qDebounced.trim());
      url.searchParams.set("limit", "200");

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; items?: Item[]; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "load_failed");
      setItems(json.items ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      setItems([]);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, days, sort, unread, qDebounced]);

  return (
    <div className="grid gap-4">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-3">
            <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Bereich</div>
            <select
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm outline-none focus:border-[color:var(--ring)]"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="">Alle</option>
              <option value="kontakt">Kontakt</option>
              <option value="eh">EH-Ausbildung</option>
              <option value="sanitaet">Sanitätsdienst</option>
              <option value="boerse">Personal (Börse)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Zeitraum</div>
            <select
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm outline-none focus:border-[color:var(--ring)]"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <option value="7">Letzte 7 Tage</option>
              <option value="30">Letzte 30 Tage</option>
              <option value="90">Letzte 90 Tage</option>
              <option value="">Alle</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Sortierung</div>
            <select
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm outline-none focus:border-[color:var(--ring)]"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="newest">Neueste</option>
              <option value="oldest">Älteste</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Status</div>
            <select
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm outline-none focus:border-[color:var(--ring)]"
              value={unread}
              onChange={(e) => setUnread(e.target.value)}
            >
              <option value="">Alle</option>
              <option value="1">Ungelesen</option>
              <option value="0">Gelesen</option>
            </select>
          </div>

          <div className="md:col-span-9">
            <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Suche</div>
            <input
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm outline-none focus:border-[color:var(--ring)]"
              placeholder="Name, Firma, E-Mail, Nachricht…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={() => void load()}
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-50"
              disabled={busy}
            >
              {busy ? "Lade…" : "Aktualisieren"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Fehler: {error}
        </div>
      ) : null}

      <div className="grid gap-3">
        {items.length === 0 && !busy ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[color:var(--muted)] shadow-[var(--shadow-soft)]">
            Keine Treffer.
          </div>
        ) : null}

        {items.map((row) => (
          <Link
            key={row.id}
            href={`/contactanfragen/${row.id}`}
            className="group rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-2)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!row.readAt ? (
                    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]">
                      NEU
                    </span>
                  ) : null}
                  <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">
                    #{row.id} · {new Date(row.createdAt).toLocaleString("de-DE")}
                  </span>
                </div>

                <div className="mt-2 truncate text-base font-semibold tracking-tight">
                  {row.name || "—"}
                  {row.company ? <span className="text-[color:var(--muted)]"> · {row.company}</span> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[color:var(--muted)]">
                  <div className="truncate">{row.email || "—"}</div>
                  {row.phone ? <div className="truncate">{row.phone}</div> : null}
                  {row.ip ? <div className="font-mono text-xs">IP: {row.ip}</div> : null}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white ${modeBadgeClass(row.mode)}`}>
                  {modeLabel(row.mode)}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-white px-2 py-1">
                  {statusLabel(row.status)}
                </span>
              </div>
            </div>

            {row.message ? (
              <div className="mt-4 text-sm leading-relaxed text-[color:var(--muted)]">
                {row.message}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
