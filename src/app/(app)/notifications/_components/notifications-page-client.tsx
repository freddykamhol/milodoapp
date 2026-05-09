"use client";

import * as React from "react";

import { Badge, Card } from "../../_components/ui";

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
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function NotificationsPageClient() {
  const [busy, setBusy] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unread, setUnread] = React.useState<NotificationItem[]>([]);
  const [recent, setRecent] = React.useState<NotificationItem[]>([]);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/notifications?view=page", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const json = (await res.json().catch(() => null)) as
      | { ok: true; unreadCount: number; unread: NotificationItem[]; recent: NotificationItem[] }
      | { ok: false };
    if (!json || !("ok" in json) || !json.ok) return;
    setUnreadCount(json.unreadCount ?? 0);
    setUnread(json.unread ?? []);
    setRecent(json.recent ?? []);
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function markRead(ids: number[] | "all") {
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

  function NotificationRow({ n, forceUnread }: { n: NotificationItem; forceUnread?: boolean }) {
    const isUnread = forceUnread ? true : !n.read;

    return (
      <div
        className={[
          "rounded-2xl border border-[var(--border)] px-4 py-3",
          isUnread ? "bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)]" : "bg-[var(--surface)]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isUnread ? <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]" /> : null}
              <p className="truncate text-sm font-semibold">{n.title}</p>
            </div>
            {n.body ? <p className="mt-1 text-xs text-[color:var(--muted)]">{n.body}</p> : null}
            <p className="mt-2 text-[11px] font-semibold text-[color:var(--muted)]">{formatTime(n.createdAt)}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {n.href ? <Badge tone="muted">Öffnen</Badge> : null}
            {isUnread ? (
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
              if (isUnread) await markRead([n.id]);
              window.location.href = n.href;
            }}
            className="mt-3 w-full rounded-xl bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] px-3 py-2 text-xs font-semibold text-[color:var(--accent)] hover:brightness-95 disabled:opacity-50"
          >
            Zum Inhalt
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Ungelesen"
        description="Alle ungelesenen Benachrichtigungen (unabhängig vom Datum)."
        actions={
          <button
            type="button"
            disabled={busy || unreadCount === 0}
            onClick={() => void markRead("all")}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            Alle gelesen
          </button>
        }
      >
        {unreadCount === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4">
            <p className="text-sm font-semibold">Keine neue benachrichtigung 🎉</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">Sobald etwas Neues passiert, taucht es hier auf.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {unread.map((n) => (
              <NotificationRow key={n.id} n={n} forceUnread />
            ))}
          </div>
        )}
      </Card>

      <Card title="Letzte 7 Tage" description="Alle Benachrichtigungen der letzten 7 Tage (gelesen + ungelesen).">
        {recent.length ? (
          <div className="flex flex-col gap-3">
            {recent.map((n) => (
              <NotificationRow key={n.id} n={n} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">Keine Benachrichtigungen in den letzten 7 Tagen.</p>
        )}
      </Card>
    </div>
  );
}

