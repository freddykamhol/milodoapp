"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

function isoToLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function AppointmentEditClient({
  appointment,
  customers,
}: {
  appointment: {
    id: number;
    startAt: string;
    endAt: string | null;
    title: string;
    einsatzort: string;
    customerId: number;
    bereich: string;
    dienstart: string | null;
    staffingStatus: string;
    state: string;
  };
  customers: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [startLocal, setStartLocal] = React.useState(() => isoToLocalInput(appointment.startAt));
  const [endLocal, setEndLocal] = React.useState(() => (appointment.endAt ? isoToLocalInput(appointment.endAt) : ""));
  const [title, setTitle] = React.useState(appointment.title);
  const [einsatzort, setEinsatzort] = React.useState(appointment.einsatzort);
  const [customerId, setCustomerId] = React.useState(String(appointment.customerId));
  const [bereich, setBereich] = React.useState(appointment.bereich);
  const [dienstart, setDienstart] = React.useState(appointment.dienstart ?? "");
  const [staffingStatus, setStaffingStatus] = React.useState(appointment.staffingStatus);
  const [state, setState] = React.useState(appointment.state);

  const save = async () => {
    setError(null);
    const startAt = localInputToIso(startLocal);
    const endAt = endLocal ? localInputToIso(endLocal) : null;
    if (!startAt) return setError("Startzeit ist ungültig.");
    if (!title.trim()) return setError("Titel fehlt.");
    if (!einsatzort.trim()) return setError("Einsatzort fehlt.");
    if (!customerId) return setError("Kunde fehlt.");
    setIsSaving(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startAt,
          endAt,
          title,
          einsatzort,
          customerId: Number(customerId),
          bereich,
          dienstart: dienstart || null,
          staffingStatus,
          state,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Start</span>
        <input
          type="datetime-local"
          value={startLocal}
          onChange={(e) => setStartLocal(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Ende</span>
        <input
          type="datetime-local"
          value={endLocal}
          onChange={(e) => setEndLocal(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        />
      </label>

      <label className="block md:col-span-2">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Titel</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        />
      </label>

      <label className="block md:col-span-2">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Einsatzort</span>
        <input
          value={einsatzort}
          onChange={(e) => setEinsatzort(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Kunde</span>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          {customers.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Bereich</span>
        <select
          value={bereich}
          onChange={(e) => setBereich(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          <option value="RD_BOERSE">Rettungsdienst-Börse</option>
          <option value="SANITATSDIENST">Sanitätsdienst</option>
          <option value="ERSTE_HILFE">Erste Hilfe</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Dienstart</span>
        <select
          value={dienstart}
          onChange={(e) => setDienstart(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          <option value="">—</option>
          <option value="KTW">KTW</option>
          <option value="NKTW">NKTW</option>
          <option value="RTW">RTW</option>
          <option value="NEF">NEF</option>
          <option value="ITW">ITW</option>
          <option value="S_RTW">S-RTW</option>
          <option value="SONSTIGES">Sonstiges</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Personalstatus</span>
        <select
          value={staffingStatus}
          onChange={(e) => setStaffingStatus(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          <option value="BESETZT">Besetzt</option>
          <option value="UNTERBESETZT">Unterbesetzt</option>
          <option value="UNBESETZT">Unbesetzt</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Status</span>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          <option value="OPEN">Offen</option>
          <option value="CANCELLED">Abgesagt</option>
          <option value="CLOSED">Geschlossen</option>
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void save()}
          className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
        >
          Speichern
        </button>
        {error ? <p className="text-xs font-semibold text-[color:var(--danger)]">{error}</p> : null}
      </div>
    </div>
  );
}
