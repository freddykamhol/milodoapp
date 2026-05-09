"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "../../../../_components/ui";

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

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

type CustomerDraft = {
  id: number;
  firma: string;
  ansprechpartner: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  hauptbereich: "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";
};

export function MemberEditClient({
  userId,
  username,
  role,
  initial,
  customer,
}: {
  userId: number;
  username: string;
  role: string;
  initial: {
    firstName: string;
    lastName: string;
    geb: string;
    strasse: string;
    hausnummer: string;
    plz: string;
    ort: string;
    ortErgaenzung: string;
    email: string;
    telefon: string;
    hourlyRateQualRdCents: number | null;
    hourlyRateQualAusbCents: number | null;
  };
  customer: CustomerDraft | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(initial);
  const [cust, setCust] = React.useState<CustomerDraft | null>(customer);
  const [busy, setBusy] = React.useState(false);

  const [rates, setRates] = React.useState(() => ({
    rd: draft.hourlyRateQualRdCents != null ? centsToEuro(draft.hourlyRateQualRdCents) : "",
    ausb: draft.hourlyRateQualAusbCents != null ? centsToEuro(draft.hourlyRateQualAusbCents) : "",
  }));

  async function submit() {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: draft.firstName,
        lastName: draft.lastName,
        geb: draft.geb || null,
        strasse: draft.strasse || null,
        hausnummer: draft.hausnummer || null,
        plz: draft.plz || null,
        ort: draft.ort || null,
        ortErgaenzung: draft.ortErgaenzung || null,
        email: draft.email || null,
        telefon: draft.telefon || null,
        hourlyRateQualRdCents: euroInputToCents(rates.rd),
        hourlyRateQualAusbCents: euroInputToCents(rates.ausb),
      };

      if (cust) {
        payload.firma = cust.firma;
        payload.ansprechpartner = cust.ansprechpartner;
        payload.customerStreet = cust.strasse;
        payload.customerHouseNumber = cust.hausnummer;
        payload.customerPlz = cust.plz;
        payload.customerCity = cust.ort;
        payload.hauptbereich = cust.hauptbereich;
      }

      const res = await fetch(`/api/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "save_failed");
      window.alert("Gespeichert.");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
      window.alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="muted">@{username}</Badge>
        <Badge tone="muted">{role}</Badge>
        <Badge tone="muted">Username nicht editierbar</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Vorname</span>
          <input className={inputClass} value={draft.firstName} onChange={(e) => setDraft((v) => ({ ...v, firstName: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Nachname</span>
          <input className={inputClass} value={draft.lastName} onChange={(e) => setDraft((v) => ({ ...v, lastName: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Geburtsdatum</span>
          <input type="date" className={inputClass} value={draft.geb} onChange={(e) => setDraft((v) => ({ ...v, geb: e.target.value }))} />
        </label>
        <div />

        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">E-Mail</span>
          <input type="email" className={inputClass} value={draft.email} onChange={(e) => setDraft((v) => ({ ...v, email: e.target.value }))} />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Telefon</span>
          <input className={inputClass} value={draft.telefon} onChange={(e) => setDraft((v) => ({ ...v, telefon: e.target.value }))} />
        </label>

        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Straße</span>
          <input className={inputClass} value={draft.strasse} onChange={(e) => setDraft((v) => ({ ...v, strasse: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Hausnummer</span>
          <input className={inputClass} value={draft.hausnummer} onChange={(e) => setDraft((v) => ({ ...v, hausnummer: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">PLZ</span>
          <input className={inputClass} value={draft.plz} onChange={(e) => setDraft((v) => ({ ...v, plz: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Ort</span>
          <input className={inputClass} value={draft.ort} onChange={(e) => setDraft((v) => ({ ...v, ort: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Ortergänzung</span>
          <input className={inputClass} value={draft.ortErgaenzung} onChange={(e) => setDraft((v) => ({ ...v, ortErgaenzung: e.target.value }))} />
        </label>
      </div>

      {cust ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-sm font-semibold">Kunde</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Firma</span>
              <input className={inputClass} value={cust.firma} onChange={(e) => setCust((v) => (v ? { ...v, firma: e.target.value } : v))} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Ansprechpartner</span>
              <input className={inputClass} value={cust.ansprechpartner} onChange={(e) => setCust((v) => (v ? { ...v, ansprechpartner: e.target.value } : v))} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Straße</span>
              <input className={inputClass} value={cust.strasse} onChange={(e) => setCust((v) => (v ? { ...v, strasse: e.target.value } : v))} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Hausnummer</span>
              <input className={inputClass} value={cust.hausnummer} onChange={(e) => setCust((v) => (v ? { ...v, hausnummer: e.target.value } : v))} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">PLZ</span>
              <input className={inputClass} value={cust.plz} onChange={(e) => setCust((v) => (v ? { ...v, plz: e.target.value } : v))} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Ort</span>
              <input className={inputClass} value={cust.ort} onChange={(e) => setCust((v) => (v ? { ...v, ort: e.target.value } : v))} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Hauptbereich</span>
              <select
                className={inputClass}
                value={cust.hauptbereich}
                onChange={(e) =>
                  setCust((v) =>
                    v
                      ? { ...v, hauptbereich: e.target.value as CustomerDraft["hauptbereich"] }
                      : v,
                  )
                }
              >
                <option value="RD_BOERSE">Rettungsdienst</option>
                <option value="SANITATSDIENST">Sanitätsdienst</option>
                <option value="ERSTE_HILFE">Erste Hilfe</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {role !== "KUNDE" ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-sm font-semibold">Stundensatz (intern)</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Optionaler Override pro Mitarbeiter. Überschreibt die qualifikationsbezogenen Stundensätze aus{" "}
            <span className="font-semibold">Einstellungen → Gebühren</span>. Für das Mitglied nicht sichtbar.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Override Qualifikation RD (€/h)</span>
              <input
                inputMode="decimal"
                className={inputClass}
                placeholder="leer = aus Settings"
                value={rates.rd}
                onChange={(e) => setRates((v) => ({ ...v, rd: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Override Qualifikation EH/Ausbildung (€/h)</span>
              <input
                inputMode="decimal"
                className={inputClass}
                placeholder="leer = aus Settings"
                value={rates.ausb}
                onChange={(e) => setRates((v) => ({ ...v, ausb: e.target.value }))}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          {busy ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
