"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "../../_components/ui";

type Row = {
  appointmentId: number;
  startAt: string;
  endAt: string | null;
  title: string;
  einsatzort: string;
  customerId: number;
  customerName: string;
  createdAt: string;
};

function formatWhen(startAt: Date, endAt: Date | null) {
  const fmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  if (!endAt) return fmt.format(startAt);
  const timeFmt = new Intl.DateTimeFormat("de-DE", { timeStyle: "short" });
  return `${fmt.format(startAt)}–${timeFmt.format(endAt)}`;
}

export function CustomerRequestsClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<number | null>(null);

  async function approve(appointmentId: number) {
    setBusyId(appointmentId);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/admin/release`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) throw new Error("approve_failed");
      router.refresh();
    } catch {
      window.alert("Freigeben fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(appointmentId: number) {
    const note = window.prompt("Bemerkung zur Ablehnung (optional):", "") ?? "";
    setBusyId(appointmentId);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/admin/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) throw new Error("reject_failed");
      router.refresh();
    } catch {
      window.alert("Ablehnen fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  if (!initial.length) {
    return <p className="text-sm text-[color:var(--muted)]">Aktuell keine Kundenanforderungen, die auf Freigabe warten.</p>;
  }

  return (
    <div className="space-y-3">
      {initial.map((row) => {
        const startAt = new Date(row.startAt);
        const endAt = row.endAt ? new Date(row.endAt) : null;
        const disabled = busyId !== null;

        return (
          <div
            key={row.appointmentId}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/appointments/${row.appointmentId}`} className="text-sm font-semibold hover:underline">
                    {row.title}
                  </Link>
                  <Badge tone="danger">Nicht freigegeben</Badge>
                </div>
                <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                  {formatWhen(startAt, endAt)} • {row.einsatzort}
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                  Kunde: {row.customerName}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void reject(row.appointmentId)}
                  className="h-10 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-semibold hover:bg-[var(--surface)] disabled:opacity-60"
                >
                  {busyId === row.appointmentId ? "…" : "Ablehnen"}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void approve(row.appointmentId)}
                  className="h-10 rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
                >
                  {busyId === row.appointmentId ? "…" : "Freigeben"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

