"use client";

import * as React from "react";

import { IconBell } from "./icons";
import { Badge } from "./ui";

type NotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
  createdAt: string | number | Date;
  read: boolean;
};

function formatTime(input: NotificationItem["createdAt"]) {
  const d = new Date(input);
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function NotificationsMenu() {
  const [open, setOpen] = React.useState(false);
  const [renderPanel, setRenderPanel] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);

  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/notifications?view=panel", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const json = (await res.json().catch(() => null)) as
      | { ok: true; unreadCount: number; notifications: NotificationItem[] }
      | { ok: false };
    if (!json || !("ok" in json) || !json.ok) return;
    setItems(json.notifications ?? []);
    setUnreadCount(json.unreadCount ?? 0);
  }, []);

  React.useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);

    let t: number | null = null;
    const loop = () => {
      if (document.visibilityState === "visible") void load();
      t = window.setTimeout(loop, 15_000);
    };
    t = window.setTimeout(loop, 15_000);

    return () => {
      window.clearTimeout(initial);
      if (t) window.clearTimeout(t);
    };
  }, [load]);

  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [open, load]);

  React.useEffect(() => {
    function onRefresh() {
      void load();
    }
    window.addEventListener("milodo:notifications:refresh", onRefresh as EventListener);
    return () => window.removeEventListener("milodo:notifications:refresh", onRefresh as EventListener);
  }, [load]);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      if (renderPanel) return;
      const t = window.setTimeout(() => setRenderPanel(true), 0);
      return () => window.clearTimeout(t);
    }

    if (!renderPanel) return;
    const t = window.setTimeout(() => setRenderPanel(false), 220);
    return () => window.clearTimeout(t);
  }, [open, renderPanel]);

  async function markRead(ids: number[] | "all") {
    if (!ids || (Array.isArray(ids) && ids.length === 0)) return;
    setBusy(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ids === "all" ? { all: true } : { ids }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.06)] transition hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]"
        aria-label="Benachrichtigungen"
        aria-expanded={open}
      >
        <IconBell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] ring-2 ring-[var(--surface)]"
            aria-hidden="true"
          />
        ) : null}
      </button>

      {renderPanel ? (
        <div
          role="dialog"
          aria-label="Benachrichtigungen"
          data-state={open ? "open" : "closed"}
          className="notifications-popover absolute right-0 z-50 mt-2 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_22px_60px_rgba(11,18,32,0.18)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Benachrichtigungen</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--muted)]">
                {unreadCount ? `${unreadCount} ungelesen` : "Keine neue benachrichtigung 🎉"}
              </p>
            </div>
            <button
              type="button"
              disabled={busy || unreadCount === 0}
              onClick={() => void markRead("all")}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)] disabled:opacity-50"
            >
              Alle gelesen
            </button>
          </div>

          <ul className="max-h-[70dvh] divide-y divide-[var(--border)] overflow-auto">
            {unreadCount === 0 ? (
              <li className="px-4 py-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4">
                  <p className="text-sm font-semibold">Keine neue benachrichtigung 🎉</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">Hier erscheinen neue Hinweise für dich.</p>
                </div>
              </li>
            ) : items.length ? (
              items.map((n) => (
                <li
                  key={n.id}
                  className="px-4 py-3 bg-[color:color-mix(in_oklab,var(--accent)_5%,transparent)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.read ? <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]" /> : null}
                        <p className="truncate text-sm font-semibold">{n.title}</p>
                      </div>
                      {n.body ? <p className="mt-1 text-xs text-[color:var(--muted)]">{n.body}</p> : null}
                      <p className="mt-2 text-[11px] font-semibold text-[color:var(--muted)]">{formatTime(n.createdAt)}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {n.href ? <Badge tone="muted">Öffnen</Badge> : null}
                      {!n.read ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void markRead([n.id])}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[11px] font-semibold hover:bg-[var(--surface-2)] disabled:opacity-50"
                        >
                          Gelesen
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {n.href ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (!n.read) await markRead([n.id]);
                        setOpen(false);
                        window.location.href = n.href;
                      }}
                      className="mt-3 w-full rounded-xl bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] px-3 py-2 text-xs font-semibold text-[color:var(--accent)] hover:brightness-95 disabled:opacity-50"
                    >
                      Zum Inhalt
                    </button>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="px-4 py-4 text-sm text-[color:var(--muted)]">Keine Benachrichtigungen.</li>
            )}
          </ul>

          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                window.location.href = "/notifications";
              }}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              Alle Benachrichtigungen
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
