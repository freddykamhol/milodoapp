"use client";

import { dateFormatter } from "@/lib/date-format";
import { notify } from "@/app/_components/feedback";
import { AppSelect } from "@/app/_components/select";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type MaintenanceAppointment = { id: number; maintenanceId: number | null; companyId: number | null; title: string; companyName: string; address: string; startAt: Date | string; endAt: Date | string | null };
export type MaintenanceCompany = { id: number; name: string; address: string };
type Maintenance = { id: number | "tuv"; title: string; intervalDays: number; lastAt: Date | null; nextAt: Date | null };
const input = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm";
function localInput(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function format(date: Date | string) { return dateFormatter({ dateStyle: "medium", timeStyle: "short" }).format(new Date(date)); }
function dateInput(date: Date | string) { const value = new Date(date); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }

function MaintenanceAppointmentActions({ appointment, companies }: { appointment: MaintenanceAppointment; companies: MaintenanceCompany[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<"edit" | "delete" | null>(null);
  const [companyId, setCompanyId] = React.useState(String(appointment.companyId ?? companies[0]?.id ?? ""));
  const [startAt, setStartAt] = React.useState(localInput(new Date(appointment.startAt)));
  const [endAt, setEndAt] = React.useState(appointment.endAt ? localInput(new Date(appointment.endAt)) : "");
  const [busy, setBusy] = React.useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch(`/api/vehicles/maintenance-appointments/${appointment.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId: Number(companyId), startAt: new Date(startAt).toISOString(), endAt: endAt ? new Date(endAt).toISOString() : null }) });
      const result = await response.json();
      if (!response.ok) { notify(result.error ?? "Termin konnte nicht geändert werden."); return; }
      setDialog(null); router.refresh();
    } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/vehicles/maintenance-appointments/${appointment.id}`, { method: "DELETE" });
      if (!response.ok) { const result = await response.json(); notify(result.error ?? "Termin konnte nicht gelöscht werden."); return; }
      setDialog(null); router.refresh();
    } finally { setBusy(false); }
  }
  return <><details className="relative"><summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-100">Aktionen⌄</summary><div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl"><button onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setDialog("edit"); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">Termin verschieben</button><button onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setDialog("delete"); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Termin löschen</button></div></details>
    {dialog ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/25 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}><section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">{dialog === "edit" ? <form onSubmit={save}><h3 className="text-xl font-bold">Wartungstermin verschieben</h3><p className="mt-1 text-sm text-[color:var(--muted)]">{appointment.title}</p><label className="mt-4 block text-sm font-semibold">Firma<AppSelect required className={`${input} mt-1`} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</AppSelect></label><p className="mt-2 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm text-[color:var(--muted)]">{companies.find((company) => String(company.id) === companyId)?.address ?? appointment.address}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Beginn<input required type="datetime-local" className={`${input} mt-1`} value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label><label className="text-sm font-semibold">Ende<input type="datetime-local" className={`${input} mt-1`} value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDialog(null)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Abbrechen</button><button disabled={busy} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white">{busy ? "Speichert …" : "Änderungen speichern"}</button></div></form> : <><h3 className="text-xl font-bold">Termin löschen?</h3><p className="mt-2 text-sm text-[color:var(--muted)]">{appointment.title} bei {appointment.companyName} am {format(appointment.startAt)} wird aus Fahrzeug und Kalender entfernt.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setDialog(null)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Abbrechen</button><button disabled={busy} onClick={() => void remove()} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">{busy ? "Löscht …" : "Termin löschen"}</button></div></>}</section></div> : null}
  </>;
}

export function MaintenanceAppointmentsList({ appointments, companies, canManage }: { appointments: MaintenanceAppointment[]; companies: MaintenanceCompany[]; canManage: boolean }) {
  if (!appointments.length) return null;
  return <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">{appointments.map((appointment) => <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50/70 px-3 py-2"><div><p className="text-xs font-bold text-sky-950">Termin: {format(appointment.startAt)} · {appointment.companyName}</p><p className="mt-0.5 text-xs text-sky-900/70">{appointment.address}</p></div><div className="flex items-center gap-2"><Link href="/calendar" className="text-xs font-semibold text-sky-800 hover:underline">Im Kalender ↗</Link>{canManage ? <MaintenanceAppointmentActions appointment={appointment} companies={companies} /> : null}</div></div>)}</div>;
}

export function MaintenanceIntervalActions({ maintenance, vehicleId, licensePlate, companies }: { maintenance: Maintenance; vehicleId: number; licensePlate: string; companies: MaintenanceCompany[] }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"done" | "appointment" | "edit" | "delete" | null>(null);
  const [completedAt, setCompletedAt] = React.useState(new Date().toISOString().slice(0, 10));
  const [confirmDone, setConfirmDone] = React.useState(false);
  const [title, setTitle] = React.useState(maintenance.title);
  const [lastAt, setLastAt] = React.useState(maintenance.lastAt ? dateInput(maintenance.lastAt) : new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = React.useState(String(maintenance.intervalDays || 180));
  const [tomorrow] = React.useState(() => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0); return date; });
  const [startAt, setStartAt] = React.useState(localInput(tomorrow));
  const [endAt, setEndAt] = React.useState(localInput(new Date(tomorrow.getTime() + 60 * 60000)));
  const [companyId, setCompanyId] = React.useState(String(companies[0]?.id ?? ""));
  const [busy, setBusy] = React.useState(false);
  const close = () => { setDialog(null); setConfirmDone(false); };

  async function send(action: string, body: object = {}) {
    setBusy(true);
    try {
      const response = await fetch(`/api/vehicles/maintenance/${maintenance.id}`, { method: action === "delete" ? "DELETE" : "PATCH", headers: { "content-type": "application/json" }, ...(action === "delete" ? {} : { body: JSON.stringify({ action, ...body }) }) });
      const result = await response.json();
      if (!response.ok) { notify(result.error ?? "Aktion fehlgeschlagen."); return false; }
      close(); router.refresh(); return true;
    } finally { setBusy(false); }
  }

  async function createAppointment(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch(`/api/vehicles/maintenance/${maintenance.id}/appointments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, companyId: Number(companyId), startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() }) });
      const result = await response.json();
      if (!response.ok) { notify(result.error ?? "Termin konnte nicht erstellt werden."); return; }
      close(); router.refresh();
    } finally { setBusy(false); }
  }

  return <>
    <details className="relative shrink-0"><summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]">Aktionen <span aria-hidden>⌄</span></summary><div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl"><button onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setCompletedAt(new Date().toISOString().slice(0, 10)); setConfirmDone(false); setDialog("done"); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">Erledigt</button><button onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setDialog("appointment"); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">Termin erstellen</button>{maintenance.id !== "tuv" ? <><button onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setTitle(maintenance.title); setLastAt(maintenance.lastAt ? dateInput(maintenance.lastAt) : ""); setIntervalDays(String(maintenance.intervalDays)); setDialog("edit"); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">Intervall bearbeiten</button><button onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setDialog("delete"); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Intervall löschen</button></> : null}</div></details>
    {dialog ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/25 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section role="dialog" aria-modal="true" className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
      {dialog === "done" ? <><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Wartungsintervall aktualisieren</p><h3 className="mt-2 text-xl font-bold">{confirmDone ? "Wartung wirklich als erledigt bestätigen?" : `${maintenance.title} als erledigt markieren`}</h3><p className="mt-2 text-sm text-[color:var(--muted)]">{licensePlate} · Das nächste Intervall wird aus dem angegebenen Erledigungsdatum berechnet.</p>{!confirmDone ? <label className="mt-5 block text-sm font-semibold">Erledigt am<input required type="date" className={`${input} mt-1`} value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} /></label> : <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm">Erledigungsdatum: <strong>{dateFormatter().format(new Date(`${completedAt}T12:00:00`))}</strong></p>}<div className="mt-5 flex justify-end gap-2"><button onClick={close} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Abbrechen</button><button disabled={busy || !completedAt} onClick={() => confirmDone ? void send("done", { vehicleId, completedAt: new Date(`${completedAt}T12:00:00`).toISOString() }) : setConfirmDone(true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? "Speichert …" : confirmDone ? "Erledigung bestätigen" : "Weiter zur Bestätigung"}</button></div></> : null}
      {dialog === "edit" ? <form onSubmit={(e) => { e.preventDefault(); void send("edit", { title, lastAt: new Date(`${lastAt}T12:00:00`).toISOString(), intervalDays: Number(intervalDays) }); }}><h3 className="text-xl font-bold">Wartungsintervall bearbeiten</h3><div className="mt-4 grid gap-3"><label className="text-sm font-semibold">Titel<input required className={`${input} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="text-sm font-semibold">Letzte Wartung<input required type="date" className={`${input} mt-1`} value={lastAt} onChange={(e) => setLastAt(e.target.value)} /></label><label className="text-sm font-semibold">Intervall in Tagen<input required min="1" type="number" className={`${input} mt-1`} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={close} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Abbrechen</button><button disabled={busy} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white">Änderungen speichern</button></div></form> : null}
      {dialog === "delete" ? <><h3 className="text-xl font-bold">Wartungsintervall löschen?</h3><p className="mt-2 text-sm text-[color:var(--muted)]">„{maintenance.title}“ und alle dazugehörigen gespeicherten Termine werden gelöscht.</p><div className="mt-5 flex justify-end gap-2"><button onClick={close} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Abbrechen</button><button disabled={busy} onClick={() => void send("delete")} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">{busy ? "Löscht …" : "Intervall löschen"}</button></div></> : null}
      {dialog === "appointment" ? <><p className="text-xs font-bold uppercase tracking-widest text-sky-700">Werkstatttermin</p><h3 className="mt-2 text-xl font-bold">{maintenance.title} · {licensePlate}</h3>{companies.length ? <form onSubmit={createAppointment} className="mt-5 space-y-3"><label className="block text-sm font-semibold">Firma<AppSelect required className={`${input} mt-1`} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</AppSelect></label><p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm text-[color:var(--muted)]">Adresse: {companies.find((company) => String(company.id) === companyId)?.address ?? "—"}</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Beginn<input required type="datetime-local" className={`${input} mt-1`} value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label><label className="text-sm font-semibold">Ende<input type="datetime-local" className={`${input} mt-1`} value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={close} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Abbrechen</button><button disabled={busy} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white">{busy ? "Speichert …" : "Termin erstellen"}</button></div></form> : <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">Lege zuerst eine Werkstatt oder Firma mit Adresse an. <Link href="/vehicles/companies" className="font-bold text-[color:var(--accent)] underline">Zu Wartungsfirmen</Link></div>}</> : null}
    </section></div> : null}
  </>;
}
