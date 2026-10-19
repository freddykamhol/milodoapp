"use client";
import { notify } from "@/app/_components/feedback";
import * as React from "react";

export function MaintenanceForm({ vehicleId }: { vehicleId: number }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [lastAt, setLastAt] = React.useState(new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = React.useState("180");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/vehicles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "maintenance", vehicleId, title, lastAt: new Date(lastAt).toISOString(), intervalDays: Number(intervalDays) }) });
    if (!response.ok) { notify((await response.json()).error ?? "Speichern fehlgeschlagen"); return; }
    window.location.reload();
  }
  return <div className="mt-4"><button type="button" onClick={() => setOpen(!open)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold">+ Wartungsintervall</button>{open ? <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:grid-cols-3"><input required placeholder="z. B. Ölwechsel" value={title} onChange={e => setTitle(e.target.value)} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /><label className="text-xs font-semibold">Letzte Wartung<input required type="date" value={lastAt} onChange={e => setLastAt(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /></label><label className="text-xs font-semibold">Intervall in Tagen<input required min="1" type="number" value={intervalDays} onChange={e => setIntervalDays(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /></label><button className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white sm:col-span-3">Intervall speichern</button></form> : null}</div>;
}
