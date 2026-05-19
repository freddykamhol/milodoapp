"use client";

import * as React from "react";

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

type Result =
  | { idx: number; ok: true; id: number; username: string; emailSent: boolean }
  | { idx: number; ok: false; error: string };

export function MembersImportClient() {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [summary, setSummary] = React.useState<{ created: number; emailed: number } | null>(null);
  const [results, setResults] = React.useState<Result[] | null>(null);

  async function submit() {
    if (!file) return window.alert("Bitte CSV-Datei auswählen.");
    setBusy(true);
    setSummary(null);
    setResults(null);

    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/members/import-csv", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; created?: number; emailed?: number; results?: Result[]; error?: string }
        | null;

      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "import_failed");
      setSummary({ created: json.created ?? 0, emailed: json.emailed ?? 0 });
      setResults(json.results ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import fehlgeschlagen.";
      window.alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-xs font-semibold text-[color:var(--muted)]">
        <p className="text-[color:var(--foreground)]">Erforderliche Spalten (Header in Zeile 1):</p>
        <p className="mt-2">
          <code className="font-mono">first_name</code>, <code className="font-mono">last_name</code>,{" "}
          <code className="font-mono">email</code>
        </p>
        <p className="mt-3 text-[color:var(--foreground)]">Optionale Spalten:</p>
        <p className="mt-2">
          <code className="font-mono">role</code> (ADMIN|VERWALTUNG|PERSONAL),{" "}
          <code className="font-mono">qual_rd</code> (SAN|RH|RS|RA|NFS),{" "}
          <code className="font-mono">qual_ausb</code> (AUSBILDER),{" "}
          <code className="font-mono">einsatzort</code> (AUSBILDUNG|RD|BEIDE),{" "}
          <code className="font-mono">geb</code> (YYYY-MM-DD),{" "}
          <code className="font-mono">telefon</code>, <code className="font-mono">strasse</code>,{" "}
          <code className="font-mono">hausnummer</code>, <code className="font-mono">plz</code>,{" "}
          <code className="font-mono">ort</code>, <code className="font-mono">ort_ergaenzung</code>,{" "}
          <code className="font-mono">locked</code> (true/false)
        </p>
        <p className="mt-3">
          Hinweis: CSV kann <code className="font-mono">;</code> oder <code className="font-mono">,</code> als Trennzeichen haben.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">CSV Datei</span>
        <input
          className={inputClass}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy || !file}
          onClick={submit}
          className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
        >
          {busy ? "Importiere…" : "Import starten"}
        </button>
      </div>

      {summary ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm font-semibold">
          Import fertig: {summary.created} erstellt, {summary.emailed} E-Mails versendet.
        </div>
      ) : null}

      {results?.length ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold">Details</p>
          <ul className="mt-3 space-y-2 text-xs font-semibold text-[color:var(--muted)]">
            {results.slice(0, 200).map((r) => (
              <li key={`${r.idx}-${r.ok ? r.id : r.error}`} className="flex items-start justify-between gap-3">
                <span>Zeile {r.idx}</span>
                {r.ok ? (
                  <span className="text-[color:var(--foreground)]">
                    OK • @{r.username} • Mail {r.emailSent ? "✓" : "✗ (Account gesperrt)"}
                  </span>
                ) : (
                  <span className="text-[color:color-mix(in_oklab,var(--danger)_90%,black)]">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
          {results.length > 200 ? (
            <p className="mt-3 text-xs font-semibold text-[color:var(--muted)]">
              (Es werden nur die ersten 200 Ergebnisse angezeigt.)
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

