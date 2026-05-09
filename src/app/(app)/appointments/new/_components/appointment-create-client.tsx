"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge, Card } from "../../../_components/ui";

type ServiceType = "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";
type RdType = "KTW" | "NKTW" | "RTW" | "NEF" | "ITW" | "S_RTW" | "SONSTIGES";
type QualValue =
  | "EH-Ausbilder"
  | "Ersthelfer"
  | "Sanitäter"
  | "Rettungshelfer"
  | "Rettungssanitäter"
  | "Rettungsassistent"
  | "Notfallsanitäter";

type RequirementRow = { id: string; minCount: number | ""; value: QualValue | "" };
type AssetRow = { id: string; count: number | ""; item: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )}`;
}

function fromLocalInput(value: string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60000);
}

function serviceTypeLabel(t: ServiceType) {
  if (t === "RD_BOERSE") return "Rettungsdienst-Börse";
  if (t === "SANITATSDIENST") return "Sanitätsdienst";
  return "Erste Hilfe";
}

function rdTypeLabel(t: RdType) {
  if (t === "S_RTW") return "S-RTW";
  return t;
}

function qualKind(value: QualValue | "") {
  if (!value) return "QUAL_RD" as const;
  if (value === "EH-Ausbilder") return "QUAL_AUSB" as const;
  if (value === "Ersthelfer") return "QUAL_AUSB" as const;
  if (value === "Sanitäter") return "QUAL_RD" as const;
  if (value === "Rettungshelfer") return "QUAL_RD" as const;
  if (value === "Rettungssanitäter") return "QUAL_RD" as const;
  if (value === "Rettungsassistent") return "QUAL_RD" as const;
  return "QUAL_RD" as const;
}

function qualDbValue(value: QualValue) {
  if (value === "EH-Ausbilder") return "AUSBILDER";
  if (value === "Ersthelfer") return "AUSBILDER";
  if (value === "Sanitäter") return "SAN";
  if (value === "Rettungshelfer") return "RH";
  if (value === "Rettungssanitäter") return "RS";
  if (value === "Rettungsassistent") return "RA";
  return "NFS";
}

const RD_DURATION_PRESETS = [
  { key: "8h", label: "8h", minutes: 8 * 60 },
  { key: "12h", label: "12h", minutes: 12 * 60 },
  { key: "24h", label: "24h", minutes: 24 * 60 },
  { key: "other", label: "Andere", minutes: 0 },
] as const;

const SAN_ASSETS = [
  "KTW",
  "NKTW",
  "RTW",
  "NEF",
  "KDOW",
  "Zelt",
  "Trage",
  "Funkgeräte",
  "San-Rucksack",
] as const;

const EH_ASSETS = ["Rea-Puppe", "Übungs-AED", "Heimlich-Trainer", "Verbandsmaterial"] as const;

export function AppointmentCreateClient({
  customers,
  mode = "admin",
  fixedCustomerId,
  fixedServiceType,
}: {
  customers: Array<{
    id: number;
    name: string;
    contactName: string;
    street: string;
    houseNumber: string;
    plz: string;
    city: string;
    email: string;
    phone: string;
  }>;
  mode?: "admin" | "customer";
  fixedCustomerId?: number;
  fixedServiceType?: ServiceType;
}) {
  const router = useRouter();
  const now = React.useMemo(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  }, []);

  const [serviceType, setServiceType] = React.useState<ServiceType>(fixedServiceType ?? "RD_BOERSE");
  const [rdType, setRdType] = React.useState<RdType>("RTW");
  const [rdDuration, setRdDuration] = React.useState<(typeof RD_DURATION_PRESETS)[number]["key"]>("12h");

  const [start, setStart] = React.useState(() => toLocalInput(now));
  const [end, setEnd] = React.useState(() => toLocalInput(addMinutes(now, 12 * 60)));
  const [endTouched, setEndTouched] = React.useState(false);

  const [eventName, setEventName] = React.useState("");

  const [customerMode, setCustomerMode] = React.useState<"select" | "new">(mode === "customer" ? "select" : "select");
  const [customerId, setCustomerId] = React.useState<number | null>(
    fixedCustomerId ?? customers[0]?.id ?? null,
  );
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const [customerDraft, setCustomerDraft] = React.useState({
    name: "",
    contactName: "",
    street: "",
    houseNumber: "",
    plz: "",
    city: "",
    email: "",
    phone: "",
    createAccount: false,
  });

  const [customerCityOptions, setCustomerCityOptions] = React.useState<string[]>([]);

  const [location, setLocation] = React.useState({
    name: "",
    street: "",
    houseNumber: "",
    plz: "",
    city: "",
  });
  const [locationCityOptions, setLocationCityOptions] = React.useState<string[]>([]);

  const [requirements, setRequirements] = React.useState<RequirementRow[]>([
    { id: crypto.randomUUID(), minCount: 1, value: "Rettungssanitäter" },
    { id: crypto.randomUUID(), minCount: "", value: "" },
  ]);

  const [assets, setAssets] = React.useState<AssetRow[]>([]);
  const [visitors, setVisitors] = React.useState<string>("");
  const [participantsCount, setParticipantsCount] = React.useState<number>(0);
  const [participants, setParticipants] = React.useState<string[]>([]);

  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [acuteInquiryEnabled, setAcuteInquiryEnabled] = React.useState(true);

  const isWithinNext7Days = React.useMemo(() => {
    const s = fromLocalInput(start);
    if (!s) return false;
    const diff = s.getTime() - now.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }, [start, now]);

  function autoEndFor(nextServiceType: ServiceType, startDate: Date, nextRdDuration = rdDuration) {
    if (nextServiceType === "ERSTE_HILFE") return addMinutes(startDate, 465);
    if (nextServiceType === "RD_BOERSE") {
      const preset = RD_DURATION_PRESETS.find((p) => p.key === nextRdDuration) ?? RD_DURATION_PRESETS[1];
      if (preset.key === "other") return null;
      return addMinutes(startDate, preset.minutes);
    }
    return null;
  }

  async function plzLookup(kind: "customer" | "location", plz: string) {
    if (!/^\d{5}$/.test(plz)) return;
    try {
      const res = await fetch(`/api/geo/plz?plz=${encodeURIComponent(plz)}`, { method: "GET" });
      if (!res.ok) return;
      const data = (await res.json()) as { cities?: string[] };
      const cities = Array.isArray(data.cities) ? data.cities : [];
      if (kind === "customer") setCustomerCityOptions(cities);
      else setLocationCityOptions(cities);
    } catch {
      // ignore
    }
  }

  const customerActive =
    customerMode === "select" && selectedCustomer
      ? {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          contactName: selectedCustomer.contactName,
          street: selectedCustomer.street,
          houseNumber: selectedCustomer.houseNumber,
          plz: selectedCustomer.plz,
          city: selectedCustomer.city,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone,
          createAccount: false,
        }
      : { id: null, ...customerDraft };

  const assetsSuggestions = serviceType === "SANITATSDIENST" ? SAN_ASSETS : serviceType === "ERSTE_HILFE" ? EH_ASSETS : [];

  const validate = () => {
    const s = fromLocalInput(start);
    const e = fromLocalInput(end);
    if (!s || !e || e <= s) return "Start/Ende ist ungültig.";
    if (!customerActive.name.trim()) return "Kunde fehlt.";
    if (!location.name.trim()) return "Einsatzort fehlt.";
    if (serviceType === "SANITATSDIENST" && !eventName.trim()) return "Veranstaltungsname fehlt.";
    if (serviceType === "RD_BOERSE" && !rdType) return "RD-Dienstart fehlt.";
    return null;
  };

  async function submit() {
    const err = validate();
    if (err) return window.alert(err);
    const s = fromLocalInput(start)!;
    const e = fromLocalInput(end)!;

    const reqs = requirements.flatMap((r) => {
      if (!r.value) return [];
      if (Number(r.minCount) <= 0) return [];
      return [
        {
          kind: qualKind(r.value),
          value: qualDbValue(r.value),
          minCount: Math.max(1, Number(r.minCount) || 1),
        },
      ];
    });

    const payload = {
      serviceType,
      startAt: s.toISOString(),
      endAt: e.toISOString(),
      eventName: serviceType === "SANITATSDIENST" ? eventName.trim() : "",
      rdType: serviceType === "RD_BOERSE" ? rdType : null,
      acuteInquiryEnabled: Boolean(acuteInquiryEnabled),
      customer: {
        id: customerActive.id,
        name: customerActive.name.trim(),
        contactName: customerActive.contactName.trim(),
        street: customerActive.street.trim(),
        houseNumber: customerActive.houseNumber.trim(),
        plz: customerActive.plz.trim(),
        city: customerActive.city.trim(),
        email: customerActive.email.trim(),
        phone: customerActive.phone.trim(),
        createAccount: mode === "admin" ? Boolean(customerActive.createAccount) : false,
      },
      location: {
        name: location.name.trim(),
        street: location.street.trim(),
        houseNumber: location.houseNumber.trim(),
        plz: location.plz.trim(),
        city: location.city.trim(),
      },
      requirements: reqs,
      assets: assets
        .filter((a) => a.item.trim() && Number(a.count) > 0)
        .map((a) => ({ item: a.item.trim(), count: Math.max(1, Number(a.count) || 1) })),
      visitors: serviceType === "SANITATSDIENST" && visitors.trim() ? Number(visitors) : null,
      participants: serviceType === "ERSTE_HILFE" ? participants : [],
      notes: notes.trim(),
    };

    setBusy(true);
    try {
      const res = await fetch("/api/appointments/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
        window.alert(data?.message || "Anlegen fehlgeschlagen.");
        return;
      }
      const data = (await res.json()) as { id?: number };
      router.push(data.id ? `/appointments/${data.id}` : "/appointments");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Grunddaten" description="Bereich, Datum/Uhrzeit und Kunde festlegen.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Bereich</span>
            <select
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
              value={serviceType}
              disabled={Boolean(fixedServiceType)}
              onChange={(e) => {
                const next = e.target.value as ServiceType;
                setServiceType(next);
                setEndTouched(false);

                const s = fromLocalInput(start);
                if (s) {
                  const auto = autoEndFor(next, s);
                  if (auto) setEnd(toLocalInput(auto));
                }

                if (next === "ERSTE_HILFE") {
                  setRequirements([
                    { id: crypto.randomUUID(), minCount: 1, value: "EH-Ausbilder" },
                    { id: crypto.randomUUID(), minCount: "", value: "" },
                  ]);
                  setAssets([
                    { id: crypto.randomUUID(), count: 1, item: "Rea-Puppe" },
                    { id: crypto.randomUUID(), count: "", item: "" },
                  ]);
                  setVisitors("");
                  setEventName("");
                  setParticipantsCount(0);
                  setParticipants([]);
                } else if (next === "SANITATSDIENST") {
                  setAssets([
                    { id: crypto.randomUUID(), count: 1, item: "KTW" },
                    { id: crypto.randomUUID(), count: "", item: "" },
                  ]);
                } else {
                  setAssets([]);
                  setVisitors("");
                  setEventName("");
                }
              }}
            >
              <option value="RD_BOERSE">{serviceTypeLabel("RD_BOERSE")}</option>
              <option value="SANITATSDIENST">{serviceTypeLabel("SANITATSDIENST")}</option>
              <option value="ERSTE_HILFE">{serviceTypeLabel("ERSTE_HILFE")}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Start</span>
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
              value={start}
              onChange={(e) => {
                const next = e.target.value;
                setStart(next);
                if (endTouched) return;
                const s = fromLocalInput(next);
                if (!s) return;
                const auto = autoEndFor(serviceType, s);
                if (auto) setEnd(toLocalInput(auto));
              }}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Ende</span>
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
              value={end}
              onChange={(e) => {
                setEndTouched(true);
                setEnd(e.target.value);
              }}
            />
            {serviceType === "RD_BOERSE" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-[color:var(--muted)]">Automatisch:</span>
                {RD_DURATION_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setRdDuration(p.key);
                      const s = fromLocalInput(start);
                      if (!s) return;
                      if (p.key === "other") return;
                      setEndTouched(false);
                      const auto = autoEndFor("RD_BOERSE", s, p.key);
                      if (auto) setEnd(toLocalInput(auto));
                    }}
                    className={[
                      "rounded-xl border px-2.5 py-1 text-[11px] font-semibold",
                      rdDuration === p.key
                        ? "border-transparent bg-[color:color-mix(in_oklab,var(--accent)_16%,transparent)] text-[color:var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[color:var(--muted)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                ))}
                <Badge tone="muted">überschreibbar</Badge>
              </div>
            ) : serviceType === "ERSTE_HILFE" ? (
              <p className="mt-2 text-[11px] font-semibold text-[color:var(--muted)]">Standard: 7,75h (überschreibbar)</p>
            ) : null}
          </label>

          {serviceType === "SANITATSDIENST" ? (
            <label className="block md:col-span-3">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Veranstaltungsname</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="z.B. Stadtfest Dortmund"
              />
            </label>
          ) : null}

          {serviceType === "RD_BOERSE" ? (
            <label className="block md:col-span-3">
              <span className="text-xs font-semibold text-[color:var(--muted)]">RD-Dienstart</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {(["KTW", "NKTW", "RTW", "NEF", "ITW", "S_RTW"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRdType(t)}
                    className={[
                      "rounded-xl border px-3 py-2 text-xs font-semibold",
                      rdType === t
                        ? "border-transparent bg-[color:color-mix(in_oklab,var(--accent)_16%,transparent)] text-[color:var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[color:var(--muted)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    {rdTypeLabel(t)}
                  </button>
                ))}
              </div>
            </label>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold tracking-tight">Kunde</p>
            {mode === "admin" ? (
              <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1">
                {[
                  { key: "select" as const, label: "Auswählen" },
                  { key: "new" as const, label: "Neu" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setCustomerMode(t.key)}
                    className={[
                      "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                      customerMode === t.key
                        ? "bg-[color:color-mix(in_oklab,var(--accent)_16%,transparent)] text-[color:var(--accent)]"
                        : "text-[color:var(--muted)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {customerMode === "select" ? (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block md:col-span-3">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Firma</span>
                <select
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={customerId ?? ""}
                  disabled={mode === "customer" || Boolean(fixedCustomerId)}
                  onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedCustomer ? (
                <div className="md:col-span-3 flex flex-wrap gap-2">
                  {selectedCustomer.contactName ? <Badge tone="muted">{selectedCustomer.contactName}</Badge> : null}
                  {selectedCustomer.email ? <Badge tone="muted">{selectedCustomer.email}</Badge> : null}
                  {selectedCustomer.phone ? <Badge tone="muted">{selectedCustomer.phone}</Badge> : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block md:col-span-3">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Firma</span>
                <input
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={customerDraft.name}
                  onChange={(e) => setCustomerDraft((s) => ({ ...s, name: e.target.value }))}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Ansprechpartner</span>
                <input
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={customerDraft.contactName}
                  onChange={(e) => setCustomerDraft((s) => ({ ...s, contactName: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Telefon</span>
                <input
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={customerDraft.phone}
                  onChange={(e) => setCustomerDraft((s) => ({ ...s, phone: e.target.value }))}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">E-Mail</span>
                <input
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={customerDraft.email}
                  onChange={(e) => setCustomerDraft((s) => ({ ...s, email: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">PLZ</span>
                <input
                  inputMode="numeric"
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={customerDraft.plz}
                  onChange={(e) => setCustomerDraft((s) => ({ ...s, plz: e.target.value }))}
                  onBlur={() => void plzLookup("customer", customerDraft.plz)}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Ort</span>
                {customerCityOptions.length > 1 ? (
                  <select
                    className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                    value={customerDraft.city}
                    onChange={(e) => setCustomerDraft((s) => ({ ...s, city: e.target.value }))}
                  >
                    <option value="">Bitte wählen…</option>
                    {customerCityOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                    value={customerDraft.city}
                    onChange={(e) => setCustomerDraft((s) => ({ ...s, city: e.target.value }))}
                    placeholder={customerCityOptions[0] ?? ""}
                  />
                )}
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Straße</span>
                <input
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={customerDraft.street}
                  onChange={(e) => setCustomerDraft((s) => ({ ...s, street: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Hausnr.</span>
                <input
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={customerDraft.houseNumber}
                  onChange={(e) => setCustomerDraft((s) => ({ ...s, houseNumber: e.target.value }))}
                />
              </label>

              <label className="block md:col-span-3">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Account anlegen</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={customerDraft.createAccount}
                    onChange={(e) => setCustomerDraft((s) => ({ ...s, createAccount: e.target.checked }))}
                  />
                  <span className="text-xs font-semibold text-[color:var(--muted)]">
                    Kunde bekommt per Mail User/Passwort (Rolle: Kunde)
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold tracking-tight">Einsatzort</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block md:col-span-3">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Name</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={location.name}
                onChange={(e) => setLocation((s) => ({ ...s, name: e.target.value }))}
              />
              {serviceType === "SANITATSDIENST" ? (
                <p className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">Bei Sanitätsdienst manuell setzen.</p>
              ) : null}
            </label>

            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Straße</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={location.street}
                onChange={(e) => setLocation((s) => ({ ...s, street: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Hausnr.</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={location.houseNumber}
                onChange={(e) => setLocation((s) => ({ ...s, houseNumber: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">PLZ</span>
              <input
                inputMode="numeric"
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={location.plz}
                onChange={(e) => setLocation((s) => ({ ...s, plz: e.target.value }))}
                onBlur={() => void plzLookup("location", location.plz)}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Ort</span>
              {locationCityOptions.length > 1 ? (
                <select
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={location.city}
                  onChange={(e) => setLocation((s) => ({ ...s, city: e.target.value }))}
                >
                  <option value="">Bitte wählen…</option>
                  {locationCityOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={location.city}
                  onChange={(e) => setLocation((s) => ({ ...s, city: e.target.value }))}
                  placeholder={locationCityOptions[0] ?? ""}
                />
              )}
            </label>
          </div>
        </div>
      </Card>

      <Card title="Personal" description="Qualifikationen und Mindestanzahl je Qualifikation.">
        <div className="space-y-2">
          {requirements.map((r) => (
            <div key={r.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Anzahl</span>
                <input
                  inputMode="numeric"
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={String(r.minCount)}
                  onChange={(e) =>
                    setRequirements((s) => {
                      const raw = e.target.value.trim();
                      const nextCount: number | "" = raw === "" ? "" : Math.max(1, Number(raw) || 1);
                      const next = s.map((x) =>
                        x.id === r.id ? { ...x, minCount: nextCount } : x,
                      );
                      const idx = next.findIndex((x) => x.id === r.id);
                      if (idx === next.length - 1 && next[idx].value) {
                        next.push({ id: crypto.randomUUID(), minCount: "", value: "" });
                      }
                      return next;
                    })
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Qualifikation</span>
                <select
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={r.value}
                  onChange={(e) =>
                    setRequirements((s) => {
                      const value = e.target.value as QualValue | "";
                      const next = s.map((x) => (x.id === r.id ? { ...x, value } : x));
                      const idx = next.findIndex((x) => x.id === r.id);
                      if (idx === next.length - 1 && value) {
                        next.push({ id: crypto.randomUUID(), minCount: 1, value: "" });
                      }
                      return next;
                    })
                  }
                >
                  <option value="">Bitte wählen…</option>
                  <option value="EH-Ausbilder">EH-Ausbilder</option>
                  <option value="Ersthelfer">Ersthelfer</option>
                  <option value="Sanitäter">Sanitäter</option>
                  <option value="Rettungshelfer">Rettungshelfer</option>
                  <option value="Rettungssanitäter">Rettungssanitäter</option>
                  <option value="Rettungsassistent">Rettungsassistent</option>
                  <option value="Notfallsanitäter">Notfallsanitäter</option>
                </select>
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setRequirements((s) => {
                      const next = s.filter((x) => x.id !== r.id);
                      return next.length ? next : [{ id: crypto.randomUUID(), minCount: 1, value: "" }];
                    })
                  }
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Entfernen
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-medium text-[color:var(--muted)]">
          Sobald du eine Zeile ausfüllst, wird automatisch die nächste hinzugefügt.
        </p>
      </Card>

      {serviceType === "SANITATSDIENST" ? (
        <Card title="Material / Fahrzeuge" description="Alles, was für den Sanitätsdienst erforderlich sein könnte.">
          <div className="space-y-2">
            {assets.map((a) => (
              <div key={a.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Anzahl</span>
                  <input
                    inputMode="numeric"
                    className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                    value={String(a.count)}
                    onChange={(e) =>
                      setAssets((s) => {
                        const raw = e.target.value.trim();
                        const nextCount: number | "" = raw === "" ? "" : Math.max(1, Number(raw) || 1);
                        const next = s.map((x) =>
                          x.id === a.id ? { ...x, count: nextCount } : x,
                        );
                        const idx = next.findIndex((x) => x.id === a.id);
                        if (idx === next.length - 1 && next[idx].item.trim()) {
                          next.push({ id: crypto.randomUUID(), count: "", item: "" });
                        }
                        return next;
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Material/Fahrzeug</span>
                  <input
                    className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                    value={a.item}
                    onChange={(e) =>
                      setAssets((s) => {
                        const item = e.target.value;
                        const next = s.map((x) => (x.id === a.id ? { ...x, item } : x));
                        const idx = next.findIndex((x) => x.id === a.id);
                        if (idx === next.length - 1 && item.trim()) {
                          next.push({ id: crypto.randomUUID(), count: 1, item: "" });
                        }
                        return next;
                      })
                    }
                    placeholder="z.B. RTW"
                    list="san-assets"
                  />
                </label>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAssets((s) => s.filter((x) => x.id !== a.id))}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            ))}
          </div>
          <datalist id="san-assets">
            {assetsSuggestions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <p className="mt-3 text-[11px] font-medium text-[color:var(--muted)]">
            Sobald du eine Zeile ausfüllst, wird automatisch die nächste hinzugefügt.
          </p>
        </Card>
      ) : serviceType === "ERSTE_HILFE" ? (
        <>
          <Card title="Material" description="Material für den Erste-Hilfe-Kurs.">
            <div className="space-y-2">
              {assets.map((a) => (
                <div key={a.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">Anzahl</span>
                    <input
                      inputMode="numeric"
                      className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                      value={String(a.count)}
                      onChange={(e) =>
                        setAssets((s) => {
                          const raw = e.target.value.trim();
                          const nextCount: number | "" = raw === "" ? "" : Math.max(1, Number(raw) || 1);
                          const next = s.map((x) =>
                            x.id === a.id ? { ...x, count: nextCount } : x,
                          );
                          const idx = next.findIndex((x) => x.id === a.id);
                          if (idx === next.length - 1 && next[idx].item.trim()) {
                            next.push({ id: crypto.randomUUID(), count: "", item: "" });
                          }
                          return next;
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">Material</span>
                    <input
                      className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                      value={a.item}
                      onChange={(e) =>
                        setAssets((s) => {
                          const item = e.target.value;
                          const next = s.map((x) => (x.id === a.id ? { ...x, item } : x));
                          const idx = next.findIndex((x) => x.id === a.id);
                          if (idx === next.length - 1 && item.trim()) {
                            next.push({ id: crypto.randomUUID(), count: 1, item: "" });
                          }
                          return next;
                        })
                      }
                      list="eh-assets"
                    />
                  </label>
                </div>
              ))}
            </div>
            <datalist id="eh-assets">
              {assetsSuggestions.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
            <p className="mt-3 text-[11px] font-medium text-[color:var(--muted)]">
              Sobald du eine Zeile ausfüllst, wird automatisch die nächste hinzugefügt.
            </p>
          </Card>

          <Card title="Teilnehmer" description="Anzahl Teilnehmer und Namensliste.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Anzahl Teilnehmer</span>
                <input
                  inputMode="numeric"
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  value={String(participantsCount)}
                  onChange={(e) => {
                    const nextCount = Math.max(0, Math.min(80, Number(e.target.value) || 0));
                    setParticipantsCount(nextCount);
                    setParticipants((prev) => {
                      const next = prev.slice(0, nextCount);
                      while (next.length < nextCount) next.push("");
                      return next;
                    });
                  }}
                />
              </label>
              <div className="md:col-span-2" />
            </div>
            {participantsCount ? (
              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {participants.map((p, idx) => (
                  <input
                    key={idx}
                    className="h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                    placeholder={`Teilnehmer ${idx + 1}`}
                    value={p}
                    onChange={(e) =>
                      setParticipants((s) => {
                        const next = s.slice();
                        next[idx] = e.target.value;
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--muted)]">Keine Teilnehmer angegeben.</p>
            )}
          </Card>
        </>
      ) : null}

      {serviceType === "SANITATSDIENST" ? (
        <Card title="Besucher" description="Nur für Sanitätsdienst.">
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Geschätzte Besucheranzahl</span>
            <input
              inputMode="numeric"
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
              value={visitors}
              onChange={(e) => setVisitors(e.target.value)}
              placeholder="z.B. 2500"
            />
          </label>
        </Card>
      ) : null}

      <Card title="Abfrage" description="Optional: kurzfristige Akutabfrage.">
        {isWithinNext7Days ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-tight">Akutabfrage</p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
                Wenn der Dienst in den nächsten 7 Tagen liegt, kann eine Akutabfrage genutzt werden.
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">Noch ohne Funktion.</p>
            </div>
            <button
              type="button"
              onClick={() => setAcuteInquiryEnabled((v) => !v)}
              className={[
                "relative h-10 w-[74px] rounded-full border p-1 transition-colors",
                acuteInquiryEnabled
                  ? "border-transparent bg-[color:var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-2)]",
              ].join(" ")}
              aria-pressed={acuteInquiryEnabled}
              aria-label="Akutabfrage umschalten"
            >
              <span
                className={[
                  "block h-8 w-8 rounded-full bg-white shadow-[0_10px_18px_rgba(0,0,0,0.12)] transition-transform",
                  acuteInquiryEnabled ? "translate-x-[34px]" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold tracking-tight">Normale Abfrage</p>
            <p className="text-xs font-semibold text-[color:var(--muted)]">
              Außerhalb der nächsten 7 Tage wird bei Erstellung automatisch eine normale Abfrage ausgelöst.
            </p>
            <p className="text-[11px] font-semibold text-[color:var(--muted)]">Noch ohne Funktion.</p>
          </div>
        )}
      </Card>

      <Card title="Bemerkung" description="Übersicht und Anlegen.">
        <textarea
          className="min-h-28 w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--ring)]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Hinweise, Besonderheiten, Ansprechpartner vor Ort…"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[color:var(--muted)]">
            Beim Anlegen wird automatisch ein Dienstdokument unter <span className="font-mono">Dienste</span> erzeugt.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
          >
            {busy ? "Speichere…" : "Anlegen"}
          </button>
        </div>
      </Card>
    </div>
  );
}
