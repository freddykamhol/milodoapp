"use client";

import * as React from "react";

type Einsatzfeld = "RETTUNGSDIENST" | "SANITAETSDIENST" | "ERSTE_HILFE_AUSBILDUNG";
type QualMed =
  | ""
  | "ERSTHELFER"
  | "SANITAETER"
  | "RETTUNGSHELFER"
  | "RETTUNGSSANITAETER"
  | "RETTUNGSASSISTENT"
  | "NOTFALLSANITAETER";
type Fahrerlaubnis = "A" | "B" | "BE" | "C1" | "C" | "CE" | "D" | "NONE";
type ContactPref = "WHATSAPP" | "EMAIL" | "TELEFON";

type UploadKind =
  | "ZEUGNIS_MED"
  | "FORTBILDUNG_RD"
  | "ARBEITSMED"
  | "FUEHRUNGSKRAEFTE"
  | "AUSBILDER_QUAL"
  | "SONSTIGE"
  | "FUEHRERSCHEIN"
  | "PSS";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Input({
  label,
  hint,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">
        {label}
        {required ? <span className="text-[color:var(--danger)]"> *</span> : null}
      </span>
      <input
        {...props}
        className={cn(
          "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none",
          "focus:border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border))] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]",
          props.className,
        )}
      />
      {hint ? <span className="mt-2 block text-xs text-[color:var(--muted)]">{hint}</span> : null}
    </label>
  );
}

function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">{label}</span>
      <select
        {...props}
        className={cn(
          "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none",
          "focus:border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border))] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]",
          props.className,
        )}
      >
        {children}
      </select>
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border)] bg-[color:var(--surface)] px-3 py-3 shadow-[var(--shadow-soft)]">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[color:var(--accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold tracking-tight",
        active
          ? "bg-[color:color-mix(in_oklab,var(--accent)_16%,transparent)] text-[color:var(--accent)] ring-1 ring-[color:color-mix(in_oklab,var(--accent)_30%,transparent)]"
          : "bg-[color:var(--surface-2)] text-[color:var(--muted)] ring-1 ring-[var(--border)]",
      )}
    >
      {label}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function FilePicker({
  label,
  hint,
  accept,
  multiple,
  files,
  onAdd,
  onReplace,
  onRemoveAt,
}: {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  files: File[];
  onAdd: (list: FileList | null) => void;
  onReplace: (list: FileList | null) => void;
  onRemoveAt: (idx: number) => void;
}) {
  const inputId = React.useId();
  const safeFiles = React.useMemo(
    () => (Array.isArray(files) ? files.filter((f) => Boolean(f && typeof (f as any).name === "string")) : []),
    [files],
  );
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <label htmlFor={inputId} className="text-sm font-semibold tracking-tight">
          {label}
        </label>
        {hint ? <p className="text-xs text-[color:var(--muted)]">{hint}</p> : null}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:brightness-[1.02]"
        >
          Dateien auswählen
        </label>
        {multiple ? (
          <label
            htmlFor={`${inputId}-add`}
            className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
          >
            Weitere hinzufügen
          </label>
        ) : null}
        <p className="text-xs text-[color:var(--muted)]">
          {safeFiles.length ? `${safeFiles.length} Datei(en) ausgewählt.` : "Keine Datei ausgewählt."}
        </p>
      </div>

      <input
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        multiple={Boolean(multiple)}
        onChange={(e) => onReplace(e.target.files)}
      />
      {multiple ? (
        <input
          id={`${inputId}-add`}
          type="file"
          accept={accept}
          className="sr-only"
          multiple
          onChange={(e) => onAdd(e.target.files)}
        />
      ) : null}

      {safeFiles.length ? (
        <ul className="mt-3 space-y-2">
          {safeFiles.map((f, idx) => (
            <li
              key={`${f.name}-${f.size}-${f.lastModified}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[color:var(--surface)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{f.name}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted)]">{Math.round(f.size / 1024)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveAt(idx)}
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function toIsoDate(value: string) {
  const s = value.trim();
  if (!s) return "";
  // expected yyyy-mm-dd
  return s;
}

export function PersonalfragebogenHonorarClient() {
  const [step, setStep] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneId, setDoneId] = React.useState<number | null>(null);

  // 1) Persönliche Daten
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [geb, setGeb] = React.useState("");
  const [nationality, setNationality] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [taxNumberLater, setTaxNumberLater] = React.useState(false);
  const [street, setStreet] = React.useState("");
  const [houseNumber, setHouseNumber] = React.useState("");
  const [plz, setPlz] = React.useState("");
  const [city, setCity] = React.useState("");
  const [cityExtra, setCityExtra] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneShare, setPhoneShare] = React.useState(false);
  const [email, setEmail] = React.useState("");

  // 2) Bank
  const [bankAccountHolderDiffers, setBankAccountHolderDiffers] = React.useState(false);
  const [bankAccountHolder, setBankAccountHolder] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [iban, setIban] = React.useState("");
  const [blz, setBlz] = React.useState("");

  // 3) Einsatz + Qualifikation + Uploads
  const [einsatzfelder, setEinsatzfelder] = React.useState<Einsatzfeld[]>([]);
  const [qualMed, setQualMed] = React.useState<QualMed>("");
  const [qualEhAusbilder, setQualEhAusbilder] = React.useState(false);

  const [files, setFiles] = React.useState<Record<UploadKind, File[]>>({
    ZEUGNIS_MED: [],
    FORTBILDUNG_RD: [],
    ARBEITSMED: [],
    FUEHRUNGSKRAEFTE: [],
    AUSBILDER_QUAL: [],
    SONSTIGE: [],
    FUEHRERSCHEIN: [],
    PSS: [],
  });

  // 4) Größen + PSA
  const [sizeTshirt, setSizeTshirt] = React.useState("");
  const [sizeJacket, setSizeJacket] = React.useState("");
  const [sizePants, setSizePants] = React.useState("");
  const [sizeShoes, setSizeShoes] = React.useState("");
  const [sizeGloves, setSizeGloves] = React.useState("");
  const [hasNeutralPsa, setHasNeutralPsa] = React.useState(false);

  // 5) Fahrerlaubnis + Upload + PSS + PKW
  const [driverLicences, setDriverLicences] = React.useState<Fahrerlaubnis[]>([]);
  const [hasPss, setHasPss] = React.useState(false);
  const [ownCar, setOwnCar] = React.useState(false);

  // 6) Kontaktkanal
  const [contactPrefs, setContactPrefs] = React.useState<ContactPref[]>([]);

  const steps = React.useMemo(
    () => [
      { n: 1, short: "Persönlich", long: "Persönliche Daten" },
      { n: 2, short: "Bank", long: "Bankverbindung" },
      { n: 3, short: "Einsatz", long: "Einsatz & Nachweise" },
      { n: 4, short: "Größen", long: "Kleidungsgrößen" },
      { n: 5, short: "Fahrerlaubnis", long: "Fahrerlaubnis & Uploads" },
      { n: 6, short: "Kontakt", long: "Kontaktwunsch" },
    ],
    [],
  );

  React.useEffect(() => {
    if (!bankAccountHolderDiffers) {
      const full = `${firstName} ${lastName}`.trim();
      setBankAccountHolder(full);
    }
  }, [bankAccountHolderDiffers, firstName, lastName]);

  const canGoNext = React.useMemo(() => {
    if (step === 1)
      return Boolean(
        firstName.trim() &&
          lastName.trim() &&
          geb.trim() &&
          street.trim() &&
          houseNumber.trim() &&
          plz.trim() &&
          city.trim() &&
          phone.trim() &&
          email.trim() &&
          nationality.trim() &&
          (taxNumber.trim() || taxNumberLater),
      );
    if (step === 2) return Boolean(bankName.trim() && iban.trim());
    if (step === 3) {
      if (!einsatzfelder.length) return false;
      const needsMed = einsatzfelder.includes("RETTUNGSDIENST") || einsatzfelder.includes("SANITAETSDIENST");
      if (needsMed && !String(qualMed || "").trim()) return false;
      const needsAusbilder = einsatzfelder.includes("ERSTE_HILFE_AUSBILDUNG");
      if (needsAusbilder && !qualEhAusbilder) return false;
      return true;
    }
    if (step === 4) return true;
    if (step === 5) return true;
    if (step === 6) return true;
    return false;
  }, [
    step,
    firstName,
    lastName,
    geb,
    nationality,
    taxNumber,
    taxNumberLater,
    street,
    houseNumber,
    plz,
    city,
    phone,
    email,
    bankName,
    iban,
    einsatzfelder,
    qualMed,
    qualEhAusbilder,
  ]);

  function toggleArray<T>(arr: T[], value: T) {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  function setFilesFor(kind: UploadKind, next: FileList | null) {
    const list = next ? Array.from(next) : [];
    setFiles((prev) => ({ ...prev, [kind]: list }));
  }

  function addFilesFor(kind: UploadKind, next: FileList | null) {
    const list = next ? Array.from(next) : [];
    if (!list.length) return;
    setFiles((prev) => ({ ...prev, [kind]: [...prev[kind], ...list] }));
  }

  function removeFile(kind: UploadKind, idx: number) {
    setFiles((prev) => ({ ...prev, [kind]: prev[kind].filter((_, i) => i !== idx) }));
  }

  const driverNoneSelected = driverLicences.includes("NONE");

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const payload = new FormData();
      payload.set("website", "");

      payload.set("firstName", firstName);
      payload.set("lastName", lastName);
      payload.set("geb", toIsoDate(geb));
      payload.set("nationality", nationality);
      payload.set("taxNumber", taxNumber);
      payload.set("taxNumberLater", taxNumberLater ? "1" : "0");
      payload.set("street", street);
      payload.set("houseNumber", houseNumber);
      payload.set("plz", plz);
      payload.set("city", city);
      payload.set("cityExtra", cityExtra);
      payload.set("phone", phone);
      payload.set("phoneShare", phoneShare ? "1" : "0");
      payload.set("email", email);

      payload.set("bankAccountHolderDiffers", bankAccountHolderDiffers ? "1" : "0");
      payload.set("bankAccountHolder", bankAccountHolder);
      payload.set("bankName", bankName);
      payload.set("iban", iban);
      payload.set("blz", blz);

      payload.set("einsatzfelderJson", JSON.stringify(einsatzfelder));
      payload.set("qualMed", qualMed);
      payload.set("qualEhAusbilder", qualEhAusbilder ? "1" : "0");

      const sizes = {
        tshirt: sizeTshirt,
        jacket: sizeJacket,
        pants: sizePants,
        shoes: sizeShoes,
        gloves: sizeGloves,
      };
      payload.set("sizesJson", JSON.stringify(sizes));
      payload.set("hasNeutralPsa", hasNeutralPsa ? "1" : "0");

      const dl = driverNoneSelected ? ["NONE"] : driverLicences.filter((x) => x !== "NONE");
      payload.set("driverLicencesJson", JSON.stringify(dl));
      payload.set("hasPss", hasPss ? "1" : "0");
      payload.set("ownCar", ownCar ? "1" : "0");

      payload.set("contactPrefsJson", JSON.stringify(contactPrefs));

      (Object.keys(files) as UploadKind[]).forEach((kind) => {
        for (const f of files[kind] || []) {
          if (!f || typeof (f as any).name !== "string") continue;
          payload.append(`file:${kind}`, f, (f as any).name);
        }
      });

      const res = await fetch("/api/public/personalfragebogen-honorar/submit", {
        method: "POST",
        body: payload,
      });
      const json = (await res.json()) as { ok: boolean; id?: number; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "submit_failed");
      setDoneId(json.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit_failed");
    } finally {
      setBusy(false);
    }
  }

  if (doneId !== null) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold tracking-tight">Danke!</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Dein Personalfragebogen wurde erfolgreich übermittelt.</p>
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-xs text-[color:var(--muted)]">Referenz</p>
          <p className="mt-1 text-sm font-semibold tracking-tight">#{doneId}</p>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(((step - 1) / (steps.length - 1)) * 100);

  return (
    <div>
      <div className="rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Schritt {step} von 6</p>
            <p className="mt-1 truncate text-sm font-semibold tracking-tight">{steps[step - 1]?.long}</p>
          </div>
          <div className="shrink-0 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
            {progressPct}%
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-2)] ring-1 ring-[var(--border)]">
          <div
            className="h-full rounded-full bg-[color:var(--accent)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {steps.map((s) => (
            <StepPill key={s.n} active={step === s.n} label={`${s.n} · ${s.short}`} />
          ))}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-3xl border border-[color:color-mix(in_oklab,var(--danger)_30%,var(--border))] bg-[color:color-mix(in_oklab,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-[color:var(--danger)] shadow-[var(--shadow-soft)]">
          <span className="font-semibold">Fehler:</span> {error}
        </div>
      ) : null}

      <div className="mt-6">
        {step === 1 ? (
          <Section title="Persönliche Daten" description="Damit wir dich korrekt anlegen und kontaktieren können.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Vorname" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input label="Nachname" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <Input
                label="Geburtsdatum"
                type="date"
                required
                value={geb}
                onChange={(e) => setGeb(e.target.value)}
                className="md:col-span-1"
              />
            <Input
              label="Steuernummer"
              required={!taxNumberLater}
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder={taxNumberLater ? "wird nachgereicht" : ""}
              disabled={taxNumberLater}
            />
            <Input label="Straße" required value={street} onChange={(e) => setStreet(e.target.value)} className="md:col-span-1" />
            <Input
              label="Hausnummer"
              required
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              className="md:col-span-1"
            />
            <Input label="PLZ" required value={plz} onChange={(e) => setPlz(e.target.value)} />
            <Input label="Ort" required value={city} onChange={(e) => setCity(e.target.value)} />
            <Input label="Adresszusatz" value={cityExtra} onChange={(e) => setCityExtra(e.target.value)} />
            <Input
              label="Telefonnummer"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              hint="Für Rückfragen und kurzfristige Abstimmungen."
            />
            <Input label="E-Mail" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

            <div className="md:col-span-2">
              <Checkbox
                checked={phoneShare}
                onChange={setPhoneShare}
                label="Telefonnummer darf an Veranstalter / Auftraggeber weitergegeben werden."
              />
            </div>

            <div className="md:col-span-2">
              <Checkbox
                checked={taxNumberLater}
                onChange={(next) => {
                  setTaxNumberLater(next);
                  if (next) setTaxNumber("");
                }}
                label="Steuernummer wird nachgereicht."
              />
            </div>
          </div>
          </Section>
        ) : null}

        {step === 2 ? (
          <Section title="Bankverbindung" description="Für die Honorarabrechnung.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Checkbox
                  checked={bankAccountHolderDiffers}
                  onChange={setBankAccountHolderDiffers}
                  label="Kontoinhaber weicht von Vor- und Nachname ab."
                />
              </div>

              {bankAccountHolderDiffers ? (
                <Input
                  label="Kontoinhaber"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  className="md:col-span-2"
                />
              ) : (
                <div className="md:col-span-2 rounded-3xl border border-[var(--border)] bg-white px-4 py-3 text-sm shadow-[var(--shadow-soft)]">
                  <p className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Kontoinhaber</p>
                  <p className="mt-1 font-semibold">{bankAccountHolder || "—"}</p>
                </div>
              )}

              <Input
                label="Kreditinstitut"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="md:col-span-2"
              />
              <Input
                label="IBAN"
                required
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                className="md:col-span-2"
                placeholder="DE…"
                autoCapitalize="characters"
              />
              <Input label="BLZ" value={blz} onChange={(e) => setBlz(e.target.value)} />
            </div>
          </Section>
        ) : null}

        {step === 3 ? (
          <Section
            title="Dein Einsatz bei uns"
            description="Wähle mindestens ein Einsatzfeld und lade (wenn vorhanden) deine Nachweise hoch."
          >
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Einsatzfeld *</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Checkbox
                    checked={einsatzfelder.includes("RETTUNGSDIENST")}
                    onChange={() => setEinsatzfelder((v) => toggleArray(v, "RETTUNGSDIENST"))}
                    label="Rettungsdienst"
                  />
                  <Checkbox
                    checked={einsatzfelder.includes("SANITAETSDIENST")}
                    onChange={() => setEinsatzfelder((v) => toggleArray(v, "SANITAETSDIENST"))}
                    label="Sanitätsdienst"
                  />
                  <Checkbox
                    checked={einsatzfelder.includes("ERSTE_HILFE_AUSBILDUNG")}
                    onChange={() => setEinsatzfelder((v) => toggleArray(v, "ERSTE_HILFE_AUSBILDUNG"))}
                    label="Erste Hilfe Ausbildung"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label="Medizinische Qualifikation (genau eine)"
                  value={qualMed}
                  onChange={(e) => setQualMed(e.target.value as QualMed)}
                  required={einsatzfelder.includes("RETTUNGSDIENST") || einsatzfelder.includes("SANITAETSDIENST")}
                >
                  <option value="">(keine Angabe)</option>
                  <option value="ERSTHELFER">Ersthelfer</option>
                  <option value="SANITAETER">Sanitäter</option>
                  <option value="RETTUNGSHELFER">Rettungshelfer</option>
                  <option value="RETTUNGSSANITAETER">Rettungssanitäter</option>
                  <option value="RETTUNGSASSISTENT">Rettungsassistent</option>
                  <option value="NOTFALLSANITAETER">Notfallsanitäter</option>
                </Select>

                <div className="md:col-span-1">
                  <div className="block">
                    <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">
                      Erste Hilfe Ausbilder
                      {einsatzfelder.includes("ERSTE_HILFE_AUSBILDUNG") ? (
                        <span className="text-[color:var(--danger)]"> *</span>
                      ) : null}
                    </span>
                    <div className="mt-2">
                      <Checkbox
                        checked={qualEhAusbilder}
                        onChange={setQualEhAusbilder}
                        label="Ausbilder-Qualifikation vorhanden"
                      />
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--muted)]">Kann zusätzlich gewählt werden.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <FilePicker
                  label="Zeugnis medizinische Qualifikation"
                  hint="PDF oder Bilder"
                  accept="application/pdf,image/*"
                  files={files.ZEUGNIS_MED}
                  onAdd={(l) => addFilesFor("ZEUGNIS_MED", l)}
                  onReplace={(l) => setFilesFor("ZEUGNIS_MED", l)}
                  onRemoveAt={(idx) => removeFile("ZEUGNIS_MED", idx)}
                />
                <FilePicker
                  label="Rettungsdienst Fortbildungsnachweis"
                  hint="PDF oder Bilder"
                  accept="application/pdf,image/*"
                  files={files.FORTBILDUNG_RD}
                  onAdd={(l) => addFilesFor("FORTBILDUNG_RD", l)}
                  onReplace={(l) => setFilesFor("FORTBILDUNG_RD", l)}
                  onRemoveAt={(idx) => removeFile("FORTBILDUNG_RD", idx)}
                />
                <FilePicker
                  label="Arbeitsmedizinische Untersuchung"
                  hint="PDF oder Bilder"
                  accept="application/pdf,image/*"
                  files={files.ARBEITSMED}
                  onAdd={(l) => addFilesFor("ARBEITSMED", l)}
                  onReplace={(l) => setFilesFor("ARBEITSMED", l)}
                  onRemoveAt={(idx) => removeFile("ARBEITSMED", idx)}
                />
                <FilePicker
                  label="Führungskräfte Ausbildung"
                  hint="PDF oder Bilder"
                  accept="application/pdf,image/*"
                  files={files.FUEHRUNGSKRAEFTE}
                  onAdd={(l) => addFilesFor("FUEHRUNGSKRAEFTE", l)}
                  onReplace={(l) => setFilesFor("FUEHRUNGSKRAEFTE", l)}
                  onRemoveAt={(idx) => removeFile("FUEHRUNGSKRAEFTE", idx)}
                />
                <FilePicker
                  label="Ausbilder-Qualifikation"
                  hint="PDF oder Bilder"
                  accept="application/pdf,image/*"
                  files={files.AUSBILDER_QUAL}
                  onAdd={(l) => addFilesFor("AUSBILDER_QUAL", l)}
                  onReplace={(l) => setFilesFor("AUSBILDER_QUAL", l)}
                  onRemoveAt={(idx) => removeFile("AUSBILDER_QUAL", idx)}
                />
                <FilePicker
                  label="Sonstige Dokumente"
                  hint="Mehrere Dateien möglich"
                  accept="application/pdf,image/*"
                  multiple
                  files={files.SONSTIGE}
                  onAdd={(l) => addFilesFor("SONSTIGE", l)}
                  onReplace={(l) => setFilesFor("SONSTIGE", l)}
                  onRemoveAt={(idx) => removeFile("SONSTIGE", idx)}
                />
              </div>
            </div>
          </Section>
        ) : null}

        {step === 4 ? (
          <Section title="Kleidungsgrößen" description="Damit wir dich bei Bedarf passend ausstatten können.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="T‑Shirt" value={sizeTshirt} onChange={(e) => setSizeTshirt(e.target.value)} placeholder="z.B. M" />
              <Input label="Jacke" value={sizeJacket} onChange={(e) => setSizeJacket(e.target.value)} placeholder="z.B. L" />
              <Input label="Hose" value={sizePants} onChange={(e) => setSizePants(e.target.value)} placeholder="z.B. 52" />
              <Input label="Schuhe" value={sizeShoes} onChange={(e) => setSizeShoes(e.target.value)} placeholder="z.B. 43" />
              <Input label="Handschuhe" value={sizeGloves} onChange={(e) => setSizeGloves(e.target.value)} placeholder="z.B. 9" />
              <div className="md:col-span-2">
                <Checkbox checked={hasNeutralPsa} onChange={setHasNeutralPsa} label="Neutrale PSA vorhanden." />
              </div>
            </div>
          </Section>
        ) : null}

        {step === 5 ? (
          <Section title="Fahrerlaubnis" description="Mehrfachauswahl möglich. Bei „Keine“ werden alle anderen deaktiviert.">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Fahrerlaubnis</p>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {(["A", "B", "BE", "C1", "C", "CE", "D"] as const).map((lic) => (
                    <Checkbox
                      key={lic}
                      checked={driverLicences.includes(lic)}
                      onChange={() => {
                        if (driverNoneSelected) return;
                        setDriverLicences((v) => toggleArray(v, lic));
                      }}
                      label={lic}
                    />
                  ))}
                  <Checkbox
                    checked={driverNoneSelected}
                    onChange={(next) => {
                      setDriverLicences(next ? ["NONE"] : []);
                      if (next) setFiles((p) => ({ ...p, FUEHRERSCHEIN: [] }));
                    }}
                    label="Keine"
                  />
                </div>
              </div>

              {!driverNoneSelected ? (
                <FilePicker
                  label="Upload Führerschein"
                  hint="Vorder- und Rückseite, PDF oder Bilder; mehrere Dateien möglich"
                  accept="application/pdf,image/*"
                  multiple
                  files={files.FUEHRERSCHEIN}
                  onAdd={(l) => addFilesFor("FUEHRERSCHEIN", l)}
                  onReplace={(l) => setFilesFor("FUEHRERSCHEIN", l)}
                  onRemoveAt={(idx) => removeFile("FUEHRERSCHEIN", idx)}
                />
              ) : null}

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Checkbox checked={hasPss} onChange={setHasPss} label="Personenbeförderungsschein vorhanden." />
                <Checkbox checked={ownCar} onChange={setOwnCar} label="Eigener PKW vorhanden." />
              </div>

              {hasPss ? (
                <FilePicker
                  label="Upload Personenbeförderungsschein"
                  hint="Falls vorhanden"
                  accept="application/pdf,image/*"
                  files={files.PSS}
                  onAdd={(l) => addFilesFor("PSS", l)}
                  onReplace={(l) => setFilesFor("PSS", l)}
                  onRemoveAt={(idx) => removeFile("PSS", idx)}
                />
              ) : null}
            </div>
          </Section>
        ) : null}

        {step === 6 ? (
          <Section title="Kontakt erwünscht per" description="Mehrfachauswahl möglich.">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <Checkbox
                  checked={contactPrefs.includes("WHATSAPP")}
                  onChange={() => setContactPrefs((v) => toggleArray(v, "WHATSAPP"))}
                  label="WhatsApp"
                />
                <Checkbox
                  checked={contactPrefs.includes("EMAIL")}
                  onChange={() => setContactPrefs((v) => toggleArray(v, "EMAIL"))}
                  label="E‑Mail"
                />
                <Checkbox
                  checked={contactPrefs.includes("TELEFON")}
                  onChange={() => setContactPrefs((v) => toggleArray(v, "TELEFON"))}
                  label="Telefon"
                />
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-white px-4 py-3 text-xs text-[color:var(--muted)] shadow-[var(--shadow-soft)]">
                <p>Mit „Absenden“ übermittelst du deine Angaben an MILODO.</p>
              </div>
            </div>
          </Section>
        ) : null}
      </div>

      <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_75%,transparent)] p-3 shadow-[var(--shadow-soft)] backdrop-blur sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)]",
              step === 1 ? "opacity-40" : "hover:bg-[var(--surface-2)]",
            )}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || busy}
          >
            Zurück
          </button>

          {step < 6 ? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow)]",
                !canGoNext || busy ? "opacity-60" : "hover:brightness-[1.02]",
              )}
              onClick={() => setStep((s) => Math.min(6, s + 1))}
              disabled={!canGoNext || busy}
            >
              Weiter
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow)]",
                busy ? "opacity-60" : "hover:brightness-[1.02]",
              )}
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? "Sende…" : "Absenden"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
