"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

export function CustomerFormClient({
  mode,
  customerId,
  initial,
}: {
  mode: "create" | "edit";
  customerId?: number;
  initial: {
    name: string;
    mainBereich: "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";
    contactName: string;
    street: string;
    houseNumber: string;
    plz: string;
    city: string;
    email: string;
    phone: string;
    createAccount?: boolean;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [cityOptions, setCityOptions] = React.useState<string[]>([]);

  async function plzLookup(plz: string) {
    if (!/^\d{5}$/.test(plz)) return;
    try {
      const res = await fetch(`/api/geo/plz?plz=${encodeURIComponent(plz)}`, { method: "GET" });
      if (!res.ok) return;
      const data = (await res.json()) as { cities?: string[] };
      const cities = Array.isArray(data.cities) ? data.cities : [];
      setCityOptions(cities);
    } catch {
      // ignore
    }
  }

  async function submit() {
    if (!draft.name.trim()) return window.alert("Firma fehlt.");
    setBusy(true);
    try {
      const url = mode === "create" ? "/api/customers" : `/api/customers/${customerId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; id?: number } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "save_failed");
      window.alert("Gespeichert.");
      router.push("/customers");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
      window.alert(msg);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!customerId) return;
    const ok = window.confirm("Kunde wirklich löschen?");
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "delete_failed");
      router.push("/customers");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
      window.alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Firma</span>
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} />
        </label>

        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Ansprechpartner</span>
          <input
            className={inputClass}
            value={draft.contactName}
            onChange={(e) => setDraft((v) => ({ ...v, contactName: e.target.value }))}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Hauptbereich</span>
          <select
            className={inputClass}
            value={draft.mainBereich}
            onChange={(e) => setDraft((v) => ({ ...v, mainBereich: e.target.value as typeof v.mainBereich }))}
          >
            <option value="RD_BOERSE">Rettungsdienst</option>
            <option value="SANITATSDIENST">Sanitätsdienst</option>
            <option value="ERSTE_HILFE">Erste Hilfe</option>
          </select>
        </label>
        <div />

        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Straße</span>
          <input className={inputClass} value={draft.street} onChange={(e) => setDraft((v) => ({ ...v, street: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Hausnummer</span>
          <input
            className={inputClass}
            value={draft.houseNumber}
            onChange={(e) => setDraft((v) => ({ ...v, houseNumber: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">PLZ</span>
          <input
            className={inputClass}
            value={draft.plz}
            onChange={(e) => {
              const plz = e.target.value;
              setDraft((v) => ({ ...v, plz }));
              void plzLookup(plz);
            }}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Ort</span>
          {cityOptions.length > 1 ? (
            <select className={inputClass} value={draft.city} onChange={(e) => setDraft((v) => ({ ...v, city: e.target.value }))}>
              <option value="">Bitte wählen…</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input className={inputClass} value={draft.city} onChange={(e) => setDraft((v) => ({ ...v, city: e.target.value }))} />
          )}
        </label>

        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">E-Mail</span>
          <input type="email" className={inputClass} value={draft.email} onChange={(e) => setDraft((v) => ({ ...v, email: e.target.value }))} />
        </label>
        {mode === "create" ? (
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:col-span-2">
            <input
              type="checkbox"
              checked={Boolean((draft as any).createAccount)}
              onChange={(e) => setDraft((v) => ({ ...(v as any), createAccount: e.target.checked }))}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Kundenaccount erstellen</p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
                Erstellt einen Login und verschickt eine Willkommensmail (Klartext-Passwort).
              </p>
            </div>
          </label>
        ) : null}
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Telefon</span>
          <input className={inputClass} value={draft.phone} onChange={(e) => setDraft((v) => ({ ...v, phone: e.target.value }))} />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === "edit" ? (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--danger)] hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            Löschen
          </button>
        ) : (
          <span />
        )}

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
