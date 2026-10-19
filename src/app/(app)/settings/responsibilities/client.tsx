"use client";
import * as React from "react";
import { RecipientSelector } from "@/app/_components/recipient-selector";
import type { RecipientSelection, RecipientUser } from "@/lib/message-types";
import { Card } from "../../_components/ui";

type Kind = "VEHICLE" | "MATERIAL";
type Row = { id: number; type: Kind; recipientType: "ROLE" | "USER" | "EMAIL"; role: "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE" | null; userId: number | null; email: string | null; location: string; username: string | null };
type Data = { rows: Row[]; users: RecipientUser[] };
const empty: RecipientSelection = { roles: [], userIds: [], emails: [] };

function selection(rows: Row[]): RecipientSelection { return { roles: rows.flatMap(row => row.recipientType === "ROLE" && row.role ? [row.role] : []), userIds: rows.flatMap(row => row.recipientType === "USER" && row.userId ? [row.userId] : []), emails: rows.flatMap(row => row.recipientType === "EMAIL" && row.email ? [row.email] : []) }; }
function recipients(value: RecipientSelection) { return [...value.roles.map(role => ({ type: "ROLE" as const, role })), ...value.userIds.map(userId => ({ type: "USER" as const, userId })), ...value.emails.map(email => ({ type: "EMAIL" as const, email }))]; }

export function ResponsibilitiesClient() {
  const [data, setData] = React.useState<Data>({ rows: [], users: [] });
  const [values, setValues] = React.useState<Record<Kind, RecipientSelection>>({ VEHICLE: empty, MATERIAL: empty });
  const [locations, setLocations] = React.useState<Record<Kind, string>>({ VEHICLE: "", MATERIAL: "" });
  const [saving, setSaving] = React.useState<Kind | null>(null); const [message, setMessage] = React.useState("");
  async function load() { const response = await fetch("/api/settings/responsibilities", { cache: "no-store" }); const result = await response.json() as Data; setData(result); setValues({ VEHICLE: selection(result.rows.filter(row => row.type === "VEHICLE")), MATERIAL: selection(result.rows.filter(row => row.type === "MATERIAL")) }); setLocations({ VEHICLE: result.rows.find(row => row.type === "VEHICLE")?.location ?? "", MATERIAL: result.rows.find(row => row.type === "MATERIAL")?.location ?? "" }); }
  React.useEffect(() => { void load(); }, []);
  async function save(type: Kind) { setSaving(type); setMessage(""); const response = await fetch("/api/settings/responsibilities", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, location: locations[type], recipients: recipients(values[type]) }) }); setSaving(null); if (!response.ok) { setMessage("Die Zuständigkeit konnte nicht gespeichert werden."); return; } setMessage(`${type === "VEHICLE" ? "Fahrzeug" : "Material"} gespeichert.`); await load(); }
  return <div className="space-y-5"><Card title="Zuständigkeiten" description="Wähle wie bei der Dokumentenverwaltung Rollen, einzelne Benutzer und zusätzliche E-Mail-Adressen. Der Standort ist nur die organisatorische Zuordnung und keine Empfängeradresse."><div className="grid gap-5 lg:grid-cols-2">{(["VEHICLE", "MATERIAL"] as const).map(type => <section key={type} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-bold">{type === "VEHICLE" ? "Fahrzeugbeauftragte" : "Materialbeauftragte"}</p><p className="mt-1 text-xs text-[color:var(--muted)]">Benachrichtigungen bei neuen Mängeln und fälligen Intervallen.</p></div><span className="rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--accent)]">{values[type].roles.length + values[type].userIds.length + values[type].emails.length} Empfänger</span></div><div className="mt-4"><RecipientSelector users={data.users} value={values[type]} disabled={saving === type} onChange={value => setValues(current => ({ ...current, [type]: value }))} /></div><label className="mt-4 block text-xs font-semibold text-[color:var(--muted)]">Standort / Zuständigkeitsbereich<input className="ui-input mt-1" placeholder="z. B. Wache Nord, Lager Berlin" value={locations[type]} disabled={saving === type} onChange={event => setLocations(current => ({ ...current, [type]: event.target.value }))} /></label><button type="button" className="ui-button-primary mt-4 w-full" disabled={saving === type} onClick={() => void save(type)}>{saving === type ? "Speichert …" : `${type === "VEHICLE" ? "Fahrzeug" : "Material"} speichern`}</button></section>)}</div>{message ? <p className="text-sm font-semibold text-[color:var(--muted)]" role="status">{message}</p> : null}</Card></div>;
}
