"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "../../_components/ui";
import { IconLock, IconUnlock } from "../../_components/icons";

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

export function ProfileEditClient({
  username,
  initial,
}: {
  username: string;
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

    publicGeb: boolean;
    publicQualifications: boolean;
    publicAddress: boolean;
    publicContact: boolean;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
          publicGeb: draft.publicGeb,
          publicQualifications: draft.publicQualifications,
          publicAddress: draft.publicAddress,
          publicContact: draft.publicContact,
        }),
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
        <Badge tone="muted">Username nicht editierbar</Badge>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <p className="text-sm font-semibold">Öffentliche Sichtbarkeit</p>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Grün = öffentlich sichtbar, Rot = privat. Admin/Verwaltung sehen immer alles.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <VisibilityRow
            label="Geburtstag"
            isPublic={draft.publicGeb}
            onToggle={() => setDraft((v) => ({ ...v, publicGeb: !v.publicGeb }))}
          />
          <VisibilityRow
            label="Qualifikationen"
            isPublic={draft.publicQualifications}
            onToggle={() => setDraft((v) => ({ ...v, publicQualifications: !v.publicQualifications }))}
          />
          <VisibilityRow
            label="Adresse"
            isPublic={draft.publicAddress}
            onToggle={() => setDraft((v) => ({ ...v, publicAddress: !v.publicAddress }))}
          />
          <VisibilityRow
            label="Kontakt (E-Mail/Telefon)"
            isPublic={draft.publicContact}
            onToggle={() => setDraft((v) => ({ ...v, publicContact: !v.publicContact }))}
          />
        </div>
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

function VisibilityRow({
  label,
  isPublic,
  onToggle,
}: {
  label: string;
  isPublic: boolean;
  onToggle: () => void;
}) {
  const IconCmp = isPublic ? IconUnlock : IconLock;
  const toneClass = isPublic ? "text-[color:var(--success)]" : "text-[color:var(--danger)]";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left hover:bg-[var(--surface)]"
    >
      <span className="text-xs font-semibold">{label}</span>
      <IconCmp className={["h-5 w-5", toneClass].join(" ")} />
    </button>
  );
}
