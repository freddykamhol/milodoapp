"use client";

import * as React from "react";

import { Badge, Card } from "../../../_components/ui";

type PrefKey = string;

type PrefRow = {
  key: PrefKey;
  enabled: boolean;
  reminderDaysBefore: number | null;
};

type Definition = {
  key: PrefKey;
  label: string;
  description: string;
  category: "Dienste" | "Stunden" | "Team";
  hasDaysBefore?: boolean;
};

function groupByCategory(items: Definition[]) {
  const order: Array<Definition["category"]> = ["Dienste", "Stunden", "Team"];
  const map = new Map(order.map((c) => [c, [] as Definition[]]));
  for (const r of items) map.get(r.category)?.push(r);
  return order.map((c) => ({ category: c, rows: map.get(c) ?? [] })).filter((g) => g.rows.length);
}

function CircleToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "grid h-6 w-6 place-items-center rounded-full border transition",
        checked
          ? "border-transparent bg-[color:var(--accent)] text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_30%,transparent)]"
          : "border-[var(--border)] bg-[var(--surface)] text-transparent hover:bg-[var(--surface-2)]",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M4.5 10.5 8.2 14.2 15.8 6.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function NotificationsClient({ initial, definitions }: { initial: PrefRow[]; definitions: Definition[] }) {
  const [prefs, setPrefs] = React.useState<Record<PrefKey, PrefRow>>(() => {
    const base = {} as Record<PrefKey, PrefRow>;
    for (const r of initial) base[r.key] = r;
    for (const r of definitions) {
      if (!base[r.key]) {
        base[r.key] = { key: r.key, enabled: false, reminderDaysBefore: null };
      }
    }
    return base;
  });

  const [savingKey, setSavingKey] = React.useState<PrefKey | null>(null);

  async function patch(key: PrefKey, update: Partial<PrefRow>) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, ...update }),
      });
      if (!res.ok) throw new Error("save_failed");
    } finally {
      setSavingKey(null);
    }
  }

  const grouped = groupByCategory(definitions);

  return (
    <Card title="Benachrichtigungen" description="Schalte Benachrichtigungen pro Ereignis an oder aus.">
      <div className="flex flex-col gap-6">
        {grouped.map((g) => (
          <section key={g.category} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold tracking-tight">{g.category}</p>
              <Badge tone="muted">{g.rows.length}</Badge>
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1fr_180px_220px] gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]">
                  <div>Ereignis</div>
                  <div className="text-center"></div>
                  <div>Option</div>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {g.rows.map((r) => {
                    const p = prefs[r.key];
                    const isSaving = savingKey === r.key;
                    const daysDisabled = r.hasDaysBefore ? !p.enabled : true;
                    return (
                      <li
                        key={r.key}
                        className="grid grid-cols-[1fr_180px_220px] items-center gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{r.label}</p>
                          <p className="mt-1 truncate text-xs text-[color:var(--muted)]">{r.description}</p>
                        </div>

                        <div className="flex items-center justify-center gap-3">
                          <CircleToggle
                            checked={p.enabled}
                            disabled={isSaving}
                            label={`${r.label}`}
                            onChange={(next) => {
                              setPrefs((s) => ({ ...s, [r.key]: { ...s[r.key], enabled: next } }));
                              void patch(r.key, { enabled: next });
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          {r.hasDaysBefore ? (
                            <>
                              <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--muted)]">
                                Tage vorher
                              </label>
                              <select
                                className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-semibold outline-none focus:border-[color:var(--ring)] disabled:opacity-60"
                                value={String(p.reminderDaysBefore ?? 1)}
                                disabled={isSaving || daysDisabled}
                                onChange={(e) => {
                                  const next = Number(e.target.value);
                                  setPrefs((s) => ({
                                    ...s,
                                    [r.key]: { ...s[r.key], reminderDaysBefore: next },
                                  }));
                                  void patch(r.key, { reminderDaysBefore: next });
                                }}
                              >
                                {Array.from({ length: 14 }).map((_, idx) => {
                                  const v = idx + 1;
                                  return (
                                    <option key={v} value={String(v)}>
                                      {v}
                                    </option>
                                  );
                                })}
                              </select>
                            </>
                          ) : (
                            <span className="text-xs text-[color:var(--muted)]">—</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        ))}

        <p className="text-xs text-[color:var(--muted)]">
          Hinweis: Die Kanäle (z.B. Mail/Telegram/Prowl) werden in „Integrationen“ konfiguriert.
        </p>
      </div>
    </Card>
  );
}
