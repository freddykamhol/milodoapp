"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { Badge } from "../../_components/ui";

type RegistrationFormItem = {
  id: number;
  title: string;
  role: string;
  userLimit: number;
  used: number;
  pending: number;
  verificationMode: "ADMIN" | "PASSWORD";
  passwordMode: "SELF" | "GENERATED";
  hasVerificationPassword: boolean;
  verificationPassword: string;
  expiresAt: string;
  active: boolean;
  link: string;
};

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

const passwordWords = [
  "Sonne",
  "Wiese",
  "Kompass",
  "Licht",
  "Hafen",
  "Morgen",
  "Quelle",
  "Fokus",
  "Bruecke",
  "Signal",
  "Anker",
];

function generateFormPassword() {
  const word = passwordWords[Math.floor(Math.random() * passwordWords.length)] ?? "Signal";
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const special = [",", "!", "."][Math.floor(Math.random() * 3)] ?? "!";
  return `${word}${digits}${special}`;
}

export function RegistrationFormsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = React.useState(false);
  const [forms, setForms] = React.useState<RegistrationFormItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createdLink, setCreatedLink] = React.useState("");
  const [createdVerificationPassword, setCreatedVerificationPassword] = React.useState("");
  const [draft, setDraft] = React.useState({
    title: "Registrierungsformular",
    userLimit: "10",
    role: "PERSONAL",
    verificationMode: "ADMIN",
    passwordMode: "SELF",
    verificationPassword: "",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  React.useEffect(() => setMounted(true), []);

  const loadForms = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/member-registration-forms");
      const json = (await res.json().catch(() => null)) as { ok?: boolean; forms?: RegistrationFormItem[]; error?: string } | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.forms)) throw new Error("Formulare konnten nicht geladen werden.");
      setForms(json.forms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Formulare konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) void loadForms();
  }, [loadForms, open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showCreate) setShowCreate(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, showCreate]);

  async function createForm() {
    setCreating(true);
    setError("");
    setCreatedLink("");
    setCreatedVerificationPassword("");
    try {
      const res = await fetch("/api/member-registration-forms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          userLimit: Number(draft.userLimit),
          role: draft.role,
          verificationMode: draft.verificationMode,
          passwordMode: draft.passwordMode,
          verificationPassword: draft.verificationPassword,
          expiresAt: draft.expiresAt,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; link?: string; verificationPassword?: string | null; error?: string }
        | null;
      if (!res.ok || !json?.ok || !json.link) throw new Error(errorText(json?.error));
      setCreatedLink(json.link);
      setCreatedVerificationPassword(json.verificationPassword || "");
      setShowCreate(false);
      await loadForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Formular konnte nicht erstellt werden.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteForm(form: RegistrationFormItem) {
    const ok = window.confirm(`Registrierungsformular löschen: ${form.title}?`);
    if (!ok) return;

    setError("");
    try {
      const res = await fetch(`/api/member-registration-forms/${form.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error("Formular konnte nicht gelöscht werden.");
      setForms((current) => current.filter((item) => item.id !== form.id));
      if (createdLink === form.link) {
        setCreatedLink("");
        setCreatedVerificationPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Formular konnte nicht gelöscht werden.");
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">Registrierungsformulare</h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">Links mit Limit, Rolle, Abschlussart und Ablaufdatum.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
          >
            Schließen
          </button>
        </div>

        <div className="max-h-[calc(88vh-72px)] overflow-y-auto p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
            >
              Neues Formular
            </button>
            {loading ? <span className="text-xs font-semibold text-[color:var(--muted)]">Lade…</span> : null}
          </div>

          {createdLink ? (
            <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <p className="text-xs font-semibold text-[color:var(--muted)]">Neuer Registrierungslink</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input readOnly className={`${inputClass} mt-0 font-mono text-xs`} value={createdLink} />
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(createdLink)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Kopieren
                </button>
              </div>
              {createdVerificationPassword ? (
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-xs font-semibold text-[color:var(--muted)]">Generiertes Formular-Passwort</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input readOnly className={`${inputClass} mt-0 font-mono text-xs`} value={createdVerificationPassword} />
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(createdVerificationPassword)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                    >
                      Kopieren
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="mb-4 text-sm font-semibold text-[color:var(--danger)]">{error}</p> : null}

          <div className="flex flex-col gap-3">
            {forms.map((form) => (
              <div key={form.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{form.title}</p>
                      <Badge tone={isUsable(form) ? "success" : "warning"}>{isUsable(form) ? "Aktiv" : "Beendet"}</Badge>
                      {form.pending ? <Badge tone="warning">{form.pending} offen</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[color:var(--muted)]">
                      {form.used}/{form.userLimit} genutzt · Rolle {form.role} · {form.verificationMode === "ADMIN" ? "Admin-Bestätigung" : "Direkt final mit Formular-Passwort"} · bis {formatDate(form.expiresAt)}
                    </p>
                    {form.verificationMode === "PASSWORD" && form.verificationPassword ? (
                      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                        <p className="text-xs font-semibold text-[color:var(--muted)]">Formular-Passwort</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input readOnly className={`${inputClass} mt-0 font-mono text-xs`} value={form.verificationPassword} />
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard?.writeText(form.verificationPassword)}
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                          >
                            Passwort kopieren
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <input readOnly className={`${inputClass} mt-3 font-mono text-xs`} value={form.link} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(form.link)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                    >
                      Link kopieren
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteForm(form)}
                      className="rounded-xl border border-[color:color-mix(in_oklab,var(--danger)_35%,var(--border))] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--danger)] hover:bg-[color:color-mix(in_oklab,var(--danger)_8%,var(--surface))]"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && forms.length === 0 ? (
            <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm font-semibold text-[color:var(--muted)]">
              Noch keine Registrierungsformulare vorhanden.
            </p>
          ) : null}
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Neues Formular</h3>
                <p className="mt-1 text-xs text-[color:var(--muted)]">Regeln für den Registrierungslink festlegen.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Abbrechen
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Titel" value={draft.title} onChange={(title) => setDraft((v) => ({ ...v, title }))} />
              <Field label="Benutzerlimit" type="number" value={draft.userLimit} onChange={(userLimit) => setDraft((v) => ({ ...v, userLimit }))} />
              <Select label="Benutzerrolle nach Erstellung" value={draft.role} onChange={(role) => setDraft((v) => ({ ...v, role }))} options={[["PERSONAL", "Personal"], ["VERWALTUNG", "Verwaltung"], ["ADMIN", "Admin"]]} />
              <Select label="Abschluss des Formulars" value={draft.verificationMode} onChange={(verificationMode) => setDraft((v) => ({ ...v, verificationMode }))} options={[["ADMIN", "Durch Admin"], ["PASSWORD", "Direkt final"]]} />
              {draft.verificationMode === "PASSWORD" ? (
                <label className="block">
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Formular-Passwort</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      className="h-10 min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                      value={draft.verificationPassword}
                      onChange={(event) =>
                        setDraft((v) => ({ ...v, verificationPassword: event.target.value, passwordMode: "SELF" }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((v) => ({
                          ...v,
                          verificationPassword: generateFormPassword(),
                          passwordMode: "GENERATED",
                        }))
                      }
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                    >
                      Generieren
                    </button>
                  </div>
                </label>
              ) : null}
              <Field label="Gültig bis" type="date" value={draft.expiresAt} onChange={(expiresAt) => setDraft((v) => ({ ...v, expiresAt }))} />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={creating}
                onClick={createForm}
                className="rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
              >
                {creating ? "Erstelle…" : "Erstellen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[color:var(--muted)]">{label}</span>
      <input type={type} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[color:var(--muted)]">{label}</span>
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function isUsable(form: RegistrationFormItem) {
  return form.active && form.used < form.userLimit && new Date(form.expiresAt).getTime() >= Date.now();
}

function errorText(error?: string) {
  if (error === "invalid_user_limit") return "Bitte ein gültiges Benutzerlimit eingeben.";
  if (error === "invalid_expires_at") return "Bitte ein gültiges Ablaufdatum eingeben.";
  if (error === "expires_in_past") return "Das Ablaufdatum liegt in der Vergangenheit.";
  if (error === "invalid_verification_password") return "Das Formular-Passwort muss mindestens 8 Zeichen lang sein.";
  return "Formular konnte nicht erstellt werden.";
}
