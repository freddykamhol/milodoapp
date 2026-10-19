"use client";

import { AppSelect } from "@/app/_components/select";
import {COURSE_TYPES,courseEnd,courseDuration,type CourseTypeId} from '@/lib/course-types';
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

type RequirementRow = { kind: "QUAL_RD" | "QUAL_AUSB"; value: string; minCount: number | "" };
type AssetRow = { item: string; count: number | "" };
type LocationData = { name: string; street: string; houseNumber: string; plz: string; city: string };

function parseDetails(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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
    courseType?:string|null;
    participantLimit?:number|null;
    eventName: string;
    notes: string;
    detailsJson: string;
    requirements: Array<{ kind: "QUAL_RD" | "QUAL_AUSB"; value: string; minCount: number }>;
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
  const initialDetails = React.useMemo(() => parseDetails(appointment.detailsJson), [appointment.detailsJson]);
  const initialLocation = (initialDetails.location && typeof initialDetails.location === "object" ? initialDetails.location : {}) as Partial<LocationData>;
  const [eventName, setEventName] = React.useState(appointment.eventName || String(initialDetails.eventName ?? ""));
  const [notes, setNotes] = React.useState(appointment.notes || String(initialDetails.notes ?? ""));
  const [location, setLocation] = React.useState<LocationData>({
    name: String(initialLocation.name ?? appointment.einsatzort ?? ""),
    street: String(initialLocation.street ?? ""),
    houseNumber: String(initialLocation.houseNumber ?? ""),
    plz: String(initialLocation.plz ?? ""),
    city: String(initialLocation.city ?? ""),
  });
  const requirementKind: RequirementRow["kind"] = appointment.bereich === "ERSTE_HILFE" ? "QUAL_AUSB" : "QUAL_RD";
  const storedRequirements = Array.isArray(initialDetails.requirements) ? initialDetails.requirements as Array<{ value?: unknown; minCount?: unknown }> : [];
  const [requirements, setRequirements] = React.useState<RequirementRow[]>(
    appointment.requirements.length
      ? appointment.requirements.map((r) => ({ ...r, kind: requirementKind }))
      : storedRequirements.length
        ? storedRequirements.map((r) => ({ kind: requirementKind, value: String(r.value ?? ""), minCount: Number(r.minCount) || 1 }))
        : [{ kind: requirementKind, value: "", minCount: 1 }],
  );
  const initialAssets = Array.isArray(initialDetails.assets) ? initialDetails.assets as Array<{ item?: unknown; count?: unknown }> : [];
  const [assets, setAssets] = React.useState<AssetRow[]>(initialAssets.map((a) => ({ item: String(a.item ?? ""), count: Number(a.count) || 1 })));
  const [visitors, setVisitors] = React.useState(String(typeof initialDetails.visitors === "number" ? initialDetails.visitors : ""));
  const [selectedCourse,setSelectedCourse]=React.useState<CourseTypeId>((appointment.courseType??'EH_AUSBILDUNG') as CourseTypeId),[participantLimit,setParticipantLimit]=React.useState(appointment.participantLimit??1);
  const computedEnd=bereich==='ERSTE_HILFE'&&Number.isFinite(+new Date(startLocal))?isoToLocalInput(courseEnd(new Date(startLocal),selectedCourse).toISOString()):endLocal;

  const save = async () => {
    setError(null);
    const startAt = localInputToIso(startLocal);
    const endAt = computedEnd ? localInputToIso(computedEnd) : null;
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
          courseType:bereich==='ERSTE_HILFE'?selectedCourse:null,
          participantLimit:bereich==='ERSTE_HILFE'?participantLimit:null,
          eventName: bereich === "SANITATSDIENST" ? eventName.trim() : "",
          notes: notes.trim(),
          location,
          requirements: requirements.filter((r) => r.value.trim()).map((r) => ({ ...r, minCount: Math.max(1, Number(r.minCount) || 1) })),
          assets: bereich === "SANITATSDIENST" ? assets.filter((a) => a.item.trim()).map((a) => ({ item: a.item.trim(), count: Math.max(1, Number(a.count) || 1) })) : [],
          visitors: bereich === "SANITATSDIENST" && visitors.trim() ? Number(visitors) : null,
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
          value={computedEnd}
          readOnly={bereich==='ERSTE_HILFE'}
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

      <label className="block md:col-span-2">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Veranstaltungsname</span>
        <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Optional, z. B. Stadtfest" className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]" />
      </label>

      <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-5">
        {([['name', 'Ort / Veranstaltungsort'], ['street', 'Straße'], ['houseNumber', 'Hausnummer'], ['plz', 'PLZ'], ['city', 'Ort']] as const).map(([key, label]) => (
          <label key={key} className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">{label}</span>
            <input value={location[key]} onChange={(e) => setLocation((current) => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]" />
          </label>
        ))}
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Kunde</span>
        <AppSelect
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          {customers.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </AppSelect>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Bereich</span>
        <AppSelect
          value={bereich}
          disabled={Boolean(appointment.courseType)}
          onChange={(e) => setBereich(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          <option value="RD_BOERSE">RD-Personalvermittlung</option>
          <option value="SANITATSDIENST">Sanitätsdienst</option>
          <option value="ERSTE_HILFE">Erste Hilfe</option>
        </AppSelect>
      </label>

      {bereich==='ERSTE_HILFE'?<><label className="text-xs font-semibold md:col-span-2">Kursart<AppSelect aria-label="Kursart" className="mt-2" value={selectedCourse} onChange={event=>setSelectedCourse(event.target.value as CourseTypeId)}>{COURSE_TYPES.map(type=><option key={type.id} value={type.id}>{type.label} ({type.units} UE)</option>)}</AppSelect><span className="mt-2 block text-[color:var(--muted)]">{courseDuration(selectedCourse)}</span></label><label className="text-xs font-semibold">Anzahl Teilnehmer<input className="ui-input mt-2" type="number" min={1} max={500} value={participantLimit} onChange={event=>setParticipantLimit(Number(event.target.value))}/></label></>:null}

      <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold">Personalansatz</p>
        <p className="mt-1 text-xs text-[color:var(--muted)]">Qualifikation und Mindestanzahl für diesen Termin.</p>
        <div className="mt-3 space-y-3">
          {requirements.map((requirement, index) => (
            <div key={`${requirement.kind}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr_auto]">
              <input type="number" min={1} value={requirement.minCount} onChange={(e) => setRequirements((rows) => rows.map((row, i) => i === index ? { ...row, minCount: e.target.value === "" ? "" : Number(e.target.value) } : row))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" aria-label="Mindestanzahl" />
              <AppSelect value={requirement.value} onChange={(e) => setRequirements((rows) => rows.map((row, i) => i === index ? { ...row, value: e.target.value } : row))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" aria-label="Qualifikation">
                <option value="">Qualifikation auswählen</option>
                <option value="EH-Ausbilder">EH-Ausbilder</option><option value="Ersthelfer">Ersthelfer</option><option value="Sanitäter">Sanitäter</option><option value="Rettungshelfer">Rettungshelfer</option><option value="Rettungssanitäter">Rettungssanitäter</option><option value="Rettungsassistent">Rettungsassistent</option><option value="Notfallsanitäter">Notfallsanitäter</option>
              </AppSelect>
              <button type="button" onClick={() => setRequirements((rows) => rows.filter((_, i) => i !== index))} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold">Entfernen</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRequirements((rows) => [...rows, { kind: requirementKind, value: "", minCount: 1 }])} className="mt-3 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold">Qualifikation hinzufügen</button>
      </div>

      {bereich === "SANITATSDIENST" ? <>
        <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-sm font-semibold">Material / Fahrzeuge</p>
          <div className="mt-3 space-y-2">{assets.map((asset, index) => <div key={index} className="grid grid-cols-[100px_1fr_auto] gap-2"><input type="number" min={1} value={asset.count} onChange={(e) => setAssets((rows) => rows.map((row, i) => i === index ? { ...row, count: e.target.value === "" ? "" : Number(e.target.value) } : row))} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" aria-label="Anzahl" /><input value={asset.item} onChange={(e) => setAssets((rows) => rows.map((row, i) => i === index ? { ...row, item: e.target.value } : row))} placeholder="Material / Fahrzeug" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" /><button type="button" onClick={() => setAssets((rows) => rows.filter((_, i) => i !== index))} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold">Entfernen</button></div>)}</div>
          <button type="button" onClick={() => setAssets((rows) => [...rows, { item: "", count: 1 }])} className="mt-3 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold">Material hinzufügen</button>
        </div>
        <label className="block md:col-span-2"><span className="text-xs font-semibold text-[color:var(--muted)]">Geschätzte Besucheranzahl</span><input type="number" min={0} value={visitors} onChange={(e) => setVisitors(e.target.value)} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm" /></label>
      </> : null}

      <label className="block md:col-span-2"><span className="text-xs font-semibold text-[color:var(--muted)]">Bemerkung</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]" /></label>
      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Dienstart</span>
        <AppSelect
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
        </AppSelect>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Personalstatus</span>
        <AppSelect
          value={staffingStatus}
          onChange={(e) => setStaffingStatus(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          <option value="BESETZT">Besetzt</option>
          <option value="UNTERBESETZT">Unterbesetzt</option>
          <option value="UNBESETZT">Unbesetzt</option>
        </AppSelect>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Status</span>
        <AppSelect
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
        >
          <option value="OPEN">Offen</option>
          <option value="CANCELLED">Abgesagt</option>
          <option value="CLOSED">Geschlossen</option>
        </AppSelect>
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
