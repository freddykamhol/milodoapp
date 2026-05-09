"use client";

import * as React from "react";

import { Card, Kpi } from "../../_components/ui";

type Kpis = { open: number; reported: number; confirmed: number };

export function DashboardKpis({ initial }: { initial: Kpis }) {
  const [kpis, setKpis] = React.useState<Kpis>(initial);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    let t: number | null = null;

    const tick = async () => {
      try {
        const res = await fetch("/api/dashboard/kpis", { method: "GET", cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; kpis?: Kpis; error?: string } | null;
        if (!alive) return;
        if (!res.ok || !json?.ok || !json.kpis) {
          setError(json?.error || "kpis_failed");
          return;
        }
        setError(null);
        setKpis(json.kpis);
      } catch {
        if (!alive) return;
        setError("kpis_failed");
      }
    };

    // sofort + dann alle 10s, aber nur wenn Tab aktiv ist
    void tick();
    const loop = () => {
      if (document.visibilityState === "visible") void tick();
      t = window.setTimeout(loop, 10_000);
    };
    t = window.setTimeout(loop, 10_000);

    return () => {
      alive = false;
      if (t) window.clearTimeout(t);
    };
  }, []);

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="p-5">
        <Kpi label="Offene Termine" value={String(kpis.open)} change={error ? "offline" : "live"} tone="accent" />
      </Card>
      <Card className="p-5">
        <Kpi label="Gemeldete Termine" value={String(kpis.reported)} change={error ? "offline" : "live"} tone="warning" />
      </Card>
      <Card className="p-5">
        <Kpi label="Zugesagte Termine" value={String(kpis.confirmed)} change={error ? "offline" : "live"} tone="success" />
      </Card>
    </section>
  );
}

