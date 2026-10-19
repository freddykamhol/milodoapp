"use client";

import { AppSelect } from "@/app/_components/select";
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
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input type="checkbox" checked={checked} disabled={disabled}
        aria-label={label} onChange={event => onChange(event.target.checked)} />
      <span>{checked ? "Aktiviert" : "Deaktiviert"}</span>
    </label>
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
              <div className="min-w-0">
                <div className="hidden grid-cols-[minmax(0,1fr)_140px_180px] gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)] xl:grid">
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
                        className="grid grid-cols-1 items-center gap-3 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_140px_180px]"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold">{r.label}</p>
                          <p className="mt-1 break-words text-xs text-[color:var(--muted)]">{r.description}</p>
                        </div>

                        <div className="flex items-center gap-3 xl:justify-center">
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
                              <AppSelect
                                aria-label={`Tage vorher: ${r.label}`}
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
                              </AppSelect>
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
