"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "../../../_components/ui";

type Kind = "INTERN";

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

export function MemberCreateClient() {
  const router = useRouter();
  const kind: Kind = "INTERN";
  const [busy, setBusy] = React.useState(false);

  const [intern, setIntern] = React.useState({
    role: "PERSONAL" as "ADMIN" | "VERWALTUNG" | "PERSONAL",
    qualRD: "" as "" | "SAN" | "RH" | "RS" | "RA" | "NFS",
    qualAusb: "" as "" | "AUSBILDER",
    einsatzort: "" as "" | "AUSBILDUNG" | "RD" | "BEIDE",
    firstName: "",
    lastName: "",
    geb: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    ortErgaenzung: "",
    email: "",
    telefon: "",
  });
  const [internCityOptions, setInternCityOptions] = React.useState<string[]>([]);

  async function plzLookup(target: "intern", plz: string) {
    if (!/^\d{5}$/.test(plz)) return;
    try {
      const res = await fetch(`/api/geo/plz?plz=${encodeURIComponent(plz)}`, { method: "GET" });
      if (!res.ok) return;
      const data = (await res.json()) as { cities?: string[] };
      const cities = Array.isArray(data.cities) ? data.cities : [];
      if (target === "intern") setInternCityOptions(cities);
    } catch {
      // ignore
    }
  }

  function validate() {
    if (!intern.firstName.trim() || !intern.lastName.trim()) return "Vor- und Nachname fehlen.";
    if (!intern.email.trim()) return "E-Mail fehlt.";
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) return window.alert(err);
    setBusy(true);
    try {
      const payload = {
        kind,
        role: intern.role,
        qualRD: intern.qualRD || null,
        qualAusb: intern.qualAusb || null,
        einsatzort: intern.einsatzort || null,
        firstName: intern.firstName,
        lastName: intern.lastName,
        geb: intern.geb || null,
        strasse: intern.strasse || null,
        hausnummer: intern.hausnummer || null,
        plz: intern.plz || null,
        ort: intern.ort || null,
        ortErgaenzung: intern.ortErgaenzung || null,
        email: intern.email || null,
        telefon: intern.telefon || null,
      };

      const res = await fetch("/api/members/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; id: number; username: string; emailSent: boolean }
        | { ok: false; error?: string };
      if (!res.ok || !json || !json.ok) {
        const err = json && "error" in json ? String(json.error || "create_failed") : "create_failed";
        throw new Error(err);
      }

      window.alert(`Mitglied angelegt: ${json.username}${json.emailSent ? " (Willkommensmail gesendet)" : ""}`);
      router.push("/members");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Anlegen.";
      window.alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold">
          Intern
        </span>
        <Badge tone="muted">Username wird automatisch vergeben</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Rolle</span>
            <select
              className={inputClass}
              value={intern.role}
              onChange={(e) => setIntern((v) => ({ ...v, role: e.target.value as typeof v.role }))}
            >
              <option value="PERSONAL">Personal</option>
              <option value="VERWALTUNG">Verwaltung</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Einsatzort</span>
            <select
              className={inputClass}
              value={intern.einsatzort}
              onChange={(e) => setIntern((v) => ({ ...v, einsatzort: e.target.value as typeof v.einsatzort }))}
            >
              <option value="">—</option>
              <option value="RD">RD</option>
              <option value="AUSBILDUNG">Ausbildung</option>
              <option value="BEIDE">Beide</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Qualifikation RD</span>
            <select
              className={inputClass}
              value={intern.qualRD}
              onChange={(e) => setIntern((v) => ({ ...v, qualRD: e.target.value as typeof v.qualRD }))}
            >
              <option value="">—</option>
              <option value="SAN">SAN</option>
              <option value="RH">RH</option>
              <option value="RS">RS</option>
              <option value="RA">RA</option>
              <option value="NFS">NFS</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Qualifikation Ausbildung</span>
            <select
              className={inputClass}
              value={intern.qualAusb}
              onChange={(e) => setIntern((v) => ({ ...v, qualAusb: e.target.value as typeof v.qualAusb }))}
            >
              <option value="">—</option>
              <option value="AUSBILDER">Ausbilder</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Vorname</span>
            <input
              className={inputClass}
              value={intern.firstName}
              onChange={(e) => setIntern((v) => ({ ...v, firstName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Nachname</span>
            <input
              className={inputClass}
              value={intern.lastName}
              onChange={(e) => setIntern((v) => ({ ...v, lastName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Geburtsdatum</span>
            <input
              type="date"
              className={inputClass}
              value={intern.geb}
              onChange={(e) => setIntern((v) => ({ ...v, geb: e.target.value }))}
            />
          </label>
          <div />

          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Straße</span>
            <input
              className={inputClass}
              value={intern.strasse}
              onChange={(e) => setIntern((v) => ({ ...v, strasse: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Hausnummer</span>
            <input
              className={inputClass}
              value={intern.hausnummer}
              onChange={(e) => setIntern((v) => ({ ...v, hausnummer: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">PLZ</span>
            <input
              className={inputClass}
              value={intern.plz}
              onChange={(e) => {
                const plz = e.target.value;
                setIntern((v) => ({ ...v, plz }));
                void plzLookup("intern", plz);
              }}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Ort</span>
            {internCityOptions.length > 1 ? (
              <select
                className={inputClass}
                value={intern.ort}
                onChange={(e) => setIntern((v) => ({ ...v, ort: e.target.value }))}
              >
                <option value="">Bitte wählen…</option>
                {internCityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputClass}
                value={intern.ort}
                onChange={(e) => setIntern((v) => ({ ...v, ort: e.target.value }))}
              />
            )}
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Ortergänzung</span>
            <input
              className={inputClass}
              value={intern.ortErgaenzung}
              onChange={(e) => setIntern((v) => ({ ...v, ortErgaenzung: e.target.value }))}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">E-Mail</span>
            <input
              type="email"
              className={inputClass}
              value={intern.email}
              onChange={(e) => setIntern((v) => ({ ...v, email: e.target.value }))}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Telefon</span>
            <input
              className={inputClass}
              value={intern.telefon}
              onChange={(e) => setIntern((v) => ({ ...v, telefon: e.target.value }))}
            />
          </label>
        </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          {busy ? "Lege an…" : "Anlegen"}
        </button>
      </div>
    </div>
  );
}
