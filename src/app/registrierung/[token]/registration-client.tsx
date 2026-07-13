"use client";

import * as React from "react";

type FormMeta = {
  title: string;
  role: string;
  verificationMode: "ADMIN" | "PASSWORD";
  passwordMode: "SELF" | "GENERATED";
  expiresAt: string;
  userLimit: number;
  used: number;
};

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

export function RegistrationClient({ token }: { token: string }) {
  const [meta, setMeta] = React.useState<FormMeta | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "done" | "error">("loading");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ username: string; pendingApproval: boolean } | null>(null);
  const [form, setForm] = React.useState({
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
    qualRD: "",
    qualAusb: "",
    einsatzort: "",
    password: "",
    passwordRepeat: "",
    verificationPassword: "",
  });

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/member-registration/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { ok?: boolean; form?: FormMeta; error?: string } | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok || !json.form) {
          setError(errorText(json?.error));
          setStatus("error");
          return;
        }
        setMeta(json.form);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setError("Das Formular konnte nicht geladen werden.");
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function validate() {
    if (!form.firstName.trim() || !form.lastName.trim()) return "Vor- und Nachname fehlen.";
    if (!form.email.trim()) return "E-Mail fehlt.";
    if (form.password.length < 8) return "Das Passwort muss mindestens 8 Zeichen lang sein.";
    if (form.password !== form.passwordRepeat) return "Die Passwörter stimmen nicht überein.";
    if (meta?.verificationMode === "PASSWORD" && !form.verificationPassword.trim()) return "Das Formular-Passwort fehlt.";
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/member-registration/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          geb: form.geb || null,
          strasse: form.strasse || null,
          hausnummer: form.hausnummer || null,
          plz: form.plz || null,
          ort: form.ort || null,
          ortErgaenzung: form.ortErgaenzung || null,
          email: form.email,
          telefon: form.telefon || null,
          qualRD: form.qualRD || null,
          qualAusb: form.qualAusb || null,
          einsatzort: form.einsatzort || null,
          password: form.password,
          verificationPassword: form.verificationPassword || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; username: string; pendingApproval: boolean }
        | { ok?: false; error?: string }
        | null;
      if (!res.ok || !json?.ok) throw new Error(errorText(json && "error" in json ? json.error : undefined));

      setResult(json);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[color:var(--foreground)] sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">Registrierung</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{meta?.title ?? "Registrierungsformular"}</h1>
          {meta ? (
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Gültig bis {formatDate(meta.expiresAt)} · {meta.used}/{meta.userLimit} Registrierungen genutzt
            </p>
          ) : null}
        </section>

        {status === "loading" ? (
          <Panel>Formular wird geladen…</Panel>
        ) : status === "error" ? (
          <Panel>{error || "Dieser Registrierungslink ist nicht verfügbar."}</Panel>
        ) : status === "done" && result ? (
          <Panel>
            <div className="flex flex-col gap-3">
              <p className="text-lg font-semibold">Registrierung abgeschlossen</p>
              <p className="text-sm text-[color:var(--muted)]">
                Dein Benutzername ist <span className="font-semibold text-[color:var(--foreground)]">@{result.username}</span>.
                {result.pendingApproval ? " Dein Konto wartet jetzt auf Admin-Bestätigung." : " Dein Konto ist direkt nutzbar."}
              </p>
            </div>
          </Panel>
        ) : (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextInput label="Vorname" value={form.firstName} onChange={(firstName) => setForm((v) => ({ ...v, firstName }))} />
              <TextInput label="Nachname" value={form.lastName} onChange={(lastName) => setForm((v) => ({ ...v, lastName }))} />
              <TextInput type="date" label="Geburtsdatum" value={form.geb} onChange={(geb) => setForm((v) => ({ ...v, geb }))} />
              <TextInput type="email" label="E-Mail" value={form.email} onChange={(email) => setForm((v) => ({ ...v, email }))} />
              <TextInput label="Telefon" value={form.telefon} onChange={(telefon) => setForm((v) => ({ ...v, telefon }))} />
              <SelectInput label="Einsatzort" value={form.einsatzort} onChange={(einsatzort) => setForm((v) => ({ ...v, einsatzort }))} options={[["", "—"], ["RD", "RD"], ["AUSBILDUNG", "Ausbildung"], ["BEIDE", "Beide"]]} />
              <SelectInput label="Qualifikation RD" value={form.qualRD} onChange={(qualRD) => setForm((v) => ({ ...v, qualRD }))} options={[["", "—"], ["SAN", "SAN"], ["RH", "RH"], ["RS", "RS"], ["RA", "RA"], ["NFS", "NFS"]]} />
              <SelectInput label="Qualifikation Ausbildung" value={form.qualAusb} onChange={(qualAusb) => setForm((v) => ({ ...v, qualAusb }))} options={[["", "—"], ["AUSBILDER", "Ausbilder"]]} />
              <TextInput label="Straße" value={form.strasse} onChange={(strasse) => setForm((v) => ({ ...v, strasse }))} />
              <TextInput label="Hausnummer" value={form.hausnummer} onChange={(hausnummer) => setForm((v) => ({ ...v, hausnummer }))} />
              <TextInput label="PLZ" value={form.plz} onChange={(plz) => setForm((v) => ({ ...v, plz }))} />
              <TextInput label="Ort" value={form.ort} onChange={(ort) => setForm((v) => ({ ...v, ort }))} />
              <TextInput label="Ortergänzung" value={form.ortErgaenzung} onChange={(ortErgaenzung) => setForm((v) => ({ ...v, ortErgaenzung }))} />

              <TextInput type="password" label="Passwort" value={form.password} onChange={(password) => setForm((v) => ({ ...v, password }))} />
              <TextInput type="password" label="Passwort wiederholen" value={form.passwordRepeat} onChange={(passwordRepeat) => setForm((v) => ({ ...v, passwordRepeat }))} />

              {meta?.verificationMode === "PASSWORD" ? (
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Formular-Passwort</span>
                  <input
                    type="password"
                    className={inputClass}
                    value={form.verificationPassword}
                    onChange={(event) => setForm((v) => ({ ...v, verificationPassword: event.target.value }))}
                  />
                </label>
              ) : null}
            </div>

            {error ? <p className="mt-4 text-sm font-semibold text-[color:var(--danger)]">{error}</p> : null}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
              >
                {busy ? "Registriere…" : "Registrieren"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm font-semibold shadow-[var(--shadow-soft)]">
      {children}
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[color:var(--muted)]">{label}</span>
      <input type={type} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
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

function errorText(error?: string) {
  if (error === "expired") return "Dieser Registrierungslink ist abgelaufen.";
  if (error === "limit_reached") return "Das Benutzerlimit für diesen Registrierungslink ist erreicht.";
  if (error === "invalid_email") return "Bitte gib eine gültige E-Mail ein.";
  if (error === "invalid_name") return "Vor- und Nachname fehlen.";
  if (error === "invalid_password") return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  if (error === "invalid_verification_password") return "Das Formular-Passwort ist nicht korrekt.";
  if (error === "email_exists") return "Diese E-Mail-Adresse ist bereits vergeben.";
  if (error === "username_exists") return "Für diese Angaben existiert bereits ein Benutzername.";
  if (error === "registration_tables_missing") return "Die Registrierungstabellen fehlen noch. Bitte Migrationen ausführen.";
  if (error === "create_failed") return "Der Benutzer konnte nicht angelegt werden.";
  return "Registrierung fehlgeschlagen.";
}
