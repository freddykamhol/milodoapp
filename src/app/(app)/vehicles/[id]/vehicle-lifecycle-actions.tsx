"use client";

import { notify } from "@/app/_components/feedback";
import * as React from "react";
import { useRouter } from "next/navigation";

type Action = "decommission" | "restore" | "delete";

export function VehicleLifecycleActions({ vehicleId, licensePlate, isActive }: { vehicleId: number; licensePlate: string; isActive: boolean }) {
  const router = useRouter();
  const [action, setAction] = React.useState<Action | null>(null);
  const [sure, setSure] = React.useState(false);
  const [plate, setPlate] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const close = () => { setAction(null); setSure(false); setPlate(""); };
  const execute = async () => {
    if (!action || plate.trim().toUpperCase() !== licensePlate.toUpperCase()) return;
    setBusy(true);
    try {
      const response = action === "delete"
        ? await fetch(`/api/vehicles/${vehicleId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ licensePlate: plate.trim().toUpperCase() }) })
        : await fetch(`/api/vehicles/${vehicleId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "lifecycle", action }) });
      if (!response.ok) { const result = await response.json(); notify(result.error ?? "Aktion fehlgeschlagen."); return; }
      close();
      if (action === "delete") router.replace("/vehicles");
      router.refresh();
    } finally { setBusy(false); }
  };
  const exactPlate = plate.trim().toUpperCase() === licensePlate.toUpperCase();
  const isDangerous = action === "delete" || action === "decommission";
  const actionColor = isDangerous ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700";

  return <>
    <div className="flex flex-wrap gap-2">
      {isActive ? <button onClick={() => setAction("decommission")} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800">S6 · Nicht einsatzbereit</button> : <button onClick={() => setAction("restore")} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800">Einsatzbereitschaft wiederherstellen</button>}
      <button onClick={() => setAction("delete")} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">Endgültig löschen</button>
    </div>
    {action ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/25 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section role="dialog" aria-modal="true" aria-labelledby="vehicle-action-title" className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
      <p className={`text-xs font-bold uppercase tracking-widest ${isDangerous ? "text-red-600" : "text-emerald-700"}`}>Fahrzeugaktion · Bestätigung erforderlich</p>
      <h2 id="vehicle-action-title" className="mt-2 text-xl font-bold">{action === "delete" ? "Fahrzeug endgültig löschen?" : action === "decommission" ? "Fahrzeug auf S6 setzen?" : "Fahrzeug wieder einsatzbereit melden?"}</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{action === "delete" ? <>Fahrzeug <strong>{licensePlate}</strong> sowie alle zugehörigen Mängel, Fahrtenbucheinträge, Wartungsdaten und Dienstzuordnungen werden unwiderruflich gelöscht.</> : action === "decommission" ? <>Alle Fahrzeugdaten bleiben erhalten. Das Fahrzeug wird als S6 / nicht einsatzbereit markiert und kann nicht mehr für neue Fahrten oder Dienste verwendet werden. Die Meldung ist jederzeit rückgängig zu machen.</> : <>Das Fahrzeug wird wieder als einsatzbereit geführt und für neue Fahrten und Dienstzuordnungen freigegeben.</>}</p>
      {!sure ? <div className="mt-6 flex justify-end gap-2"><button onClick={close} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Abbrechen</button><button onClick={() => setSure(true)} className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${actionColor}`}>Ja, ich bin mir sicher</button></div> : <>
        <label className="mt-5 block text-sm font-semibold">Zur letzten Bestätigung Kennzeichen eingeben: <span className="font-bold tracking-wide">{licensePlate}</span><input autoFocus className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 uppercase" value={plate} onChange={(event) => setPlate(event.target.value)} placeholder={licensePlate} /></label>
        <div className="mt-5 flex justify-end gap-2"><button onClick={close} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Abbrechen</button><button disabled={!exactPlate || busy} onClick={() => void execute()} className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${actionColor}`}>{busy ? "Wird ausgeführt …" : action === "delete" ? "Endgültig löschen" : action === "decommission" ? "Auf S6 setzen" : "Einsatzbereitschaft bestätigen"}</button></div>
      </>}
    </section></div> : null}
  </>;
}
