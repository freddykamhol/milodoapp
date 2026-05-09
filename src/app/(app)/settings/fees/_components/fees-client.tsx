"use client";

import * as React from "react";

import { Badge, Card } from "../../../_components/ui";

type Kind = "QUAL_RD" | "QUAL_AUSB";

type RateRow = {
  kind: Kind;
  value: string;
  hourlyRateCents: number | null;
};

function centsToEuro(cents: number) {
  const euros = cents / 100;
  return euros.toFixed(2).replace(".", ",");
}

function euroInputToCents(raw: string) {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100));
}

function kindLabel(kind: Kind) {
  return kind === "QUAL_RD" ? "Qualifikation RD" : "Qualifikation Ausbildung";
}

export function FeesClient({
  initial,
  rdQuals,
  ausbQuals,
}: {
  initial: RateRow[];
  rdQuals: string[];
  ausbQuals: string[];
}) {
  const initialMap = React.useMemo(() => {
    const m = new Map<string, RateRow>();
    for (const r of initial) m.set(`${r.kind}:${r.value}`, r);
    return m;
  }, [initial]);

  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const kind of ["QUAL_RD", "QUAL_AUSB"] as const) {
      const list = kind === "QUAL_RD" ? rdQuals : ausbQuals;
      for (const qual of list) {
        const row = initialMap.get(`${kind}:${qual}`);
        v[`${kind}:${qual}`] = row?.hourlyRateCents != null ? centsToEuro(row.hourlyRateCents) : "";
      }
    }
    return v;
  });

  const [saving, setSaving] = React.useState<string | null>(null);

  async function save(kind: Kind, qual: string) {
    const key = `${kind}:${qual}`;
    setSaving(key);
    try {
      const cents = euroInputToCents(values[key] ?? "");
      const res = await fetch("/api/settings/fees", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, value: qual, hourlyRateCents: cents }),
      });
      if (!res.ok) throw new Error("save_failed");
    } catch {
      window.alert("Speichern fehlgeschlagen.");
    } finally {
      setSaving(null);
    }
  }

  const groups: Array<{ kind: Kind; quals: string[] }> = [
    { kind: "QUAL_RD", quals: rdQuals },
    { kind: "QUAL_AUSB", quals: ausbQuals },
  ];

  return (
    <Card title="Gebühren" description="Stundensätze je Qualifikation (weitere Bereiche folgen).">
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.kind} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">{kindLabel(g.kind)}</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">Stundensatz in EUR</p>
              </div>
              <Badge tone="muted">{g.quals.length}</Badge>
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[1fr_220px_140px] gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]">
                  <div>Qualifikation</div>
                  <div>Stundensatz</div>
                  <div className="text-right">Aktion</div>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {g.quals.map((qual) => {
                    const key = `${g.kind}:${qual}`;
                    const isSaving = saving === key;
                    const raw = values[key] ?? "";
                    const cents = euroInputToCents(raw);
                    const preview = cents == null ? "—" : `${centsToEuro(cents)} € / h`;
                    return (
                      <li key={key} className="grid grid-cols-[1fr_220px_140px] items-center gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{qual}</p>
                          <p className="mt-1 text-xs text-[color:var(--muted)]">{preview}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            inputMode="decimal"
                            className="h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                            placeholder="z.B. 21,50"
                            value={raw}
                            onChange={(e) => setValues((s) => ({ ...s, [key]: e.target.value }))}
                            onBlur={() => void save(g.kind, qual)}
                            aria-label={`Stundensatz ${qual}`}
                          />
                          <span className="text-xs font-semibold text-[color:var(--muted)]">€</span>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void save(g.kind, qual)}
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
                          >
                            {isSaving ? "Speichern…" : "Speichern"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-sm font-semibold tracking-tight">Weitere Bereiche (demnächst)</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-[color:var(--muted)]">
            <li>Zuschläge (Nacht/WE/Feiertag)</li>
            <li>Raten je Kunde</li>
            <li>Raten je Dienstart (KTW/RTW/NEF/…)</li>
          </ul>
        </section>
      </div>
    </Card>
  );
}
