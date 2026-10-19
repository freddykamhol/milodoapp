"use client";
import * as React from "react";
import { Card } from "../../_components/ui";
import { notify } from "@/app/_components/feedback";

type Role = "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
type Row = { role: string; permission: string; canView: boolean; canManage: boolean };
const roles: Array<{ key: Role; label: string }> = [{ key: "ADMIN", label: "Admin" }, { key: "VERWALTUNG", label: "Verwaltung" }, { key: "PERSONAL", label: "Personal" }, { key: "KUNDE", label: "Kunde" }];
const groups = [
  { label: "Allgemein", items: [{ key: "DASHBOARD_VIEW", label: "Dashboard öffnen" }, { key: "CALENDAR_VIEW", label: "Kalender ansehen" }, { key: "CALENDAR_EXPORT", label: "Kalender exportieren" }] },
  { label: "Termine & Kurse", items: [{ key: "APPOINTMENTS_VIEW", label: "Termine ansehen" }, { key: "APPOINTMENTS_CREATE", label: "Termine anlegen" }, { key: "APPOINTMENTS_EDIT", label: "Termine bearbeiten" }, { key: "APPOINTMENTS_DELETE", label: "Termine löschen / absagen" }, { key: "APPOINTMENTS_ASSIGN", label: "Personal einteilen" }, { key: "COURSES_VIEW", label: "Kurse ansehen" }, { key: "COURSES_CREATE", label: "Kurse anlegen" }, { key: "COURSES_EDIT", label: "Kurse bearbeiten" }, { key: "COURSES_PARTICIPANTS", label: "Teilnehmer & Anwesenheit bearbeiten" }, { key: "COURSES_EXPORT", label: "Kurs-PDFs exportieren" }] },
  { label: "Fuhrpark & Material", items: [{ key: "VEHICLES_VIEW", label: "Fahrzeuge ansehen" }, { key: "VEHICLES_CREATE", label: "Fahrzeuge anlegen" }, { key: "VEHICLES_EDIT", label: "Fahrzeugdaten bearbeiten" }, { key: "VEHICLES_DEFECTS_VIEW", label: "Fahrzeugmängel ansehen" }, { key: "VEHICLES_DEFECTS_CREATE", label: "Fahrzeugmängel anlegen" }, { key: "VEHICLES_DEFECTS_EDIT", label: "Fahrzeugmängel bearbeiten / Status ändern" }, { key: "VEHICLES_DEFECTS_DELETE", label: "Fahrzeugmängel löschen" }, { key: "VEHICLES_MAINTENANCE_VIEW", label: "Wartungen ansehen" }, { key: "VEHICLES_MAINTENANCE_EDIT", label: "Wartungen bearbeiten" }, { key: "MATERIAL_VIEW", label: "Material ansehen" }, { key: "MATERIAL_CREATE", label: "Material anlegen" }, { key: "MATERIAL_EDIT", label: "Materialdaten bearbeiten" }, { key: "MATERIAL_DEFECTS_VIEW", label: "Materialmängel ansehen" }, { key: "MATERIAL_DEFECTS_CREATE", label: "Materialmängel anlegen" }, { key: "MATERIAL_DEFECTS_EDIT", label: "Materialmängel bearbeiten / Status ändern" }, { key: "MATERIAL_DEFECTS_DELETE", label: "Materialmängel löschen" }, { key: "MATERIAL_INSPECTIONS_VIEW", label: "Materialprüfungen ansehen" }, { key: "MATERIAL_INSPECTIONS_EDIT", label: "Materialprüfungen bearbeiten" }] },
  { label: "Mitglieder & Dokumente", items: [{ key: "MEMBERS_VIEW", label: "Mitglieder ansehen" }, { key: "MEMBERS_CREATE", label: "Mitglieder anlegen" }, { key: "MEMBERS_EDIT", label: "Mitgliederdaten bearbeiten" }, { key: "MEMBERS_DELETE", label: "Mitglieder sperren / löschen" }, { key: "MEMBERS_PASSWORD", label: "Passwörter setzen" }, { key: "MEMBERS_PERSONNEL_FILE", label: "Digitale Personalakte herunterladen" }, { key: "DOCUMENTS_VIEW", label: "Dokumente ansehen" }, { key: "DOCUMENTS_UPLOAD", label: "Dokumente hochladen" }, { key: "DOCUMENTS_DELETE", label: "Dokumente löschen" }, { key: "DOCUMENTS_APPROVE", label: "Dokumente freigeben" }] },
  { label: "Stunden & Kunden", items: [{ key: "HOURS_VIEW", label: "Stunden ansehen" }, { key: "HOURS_EDIT", label: "Stunden bearbeiten" }, { key: "HOURS_EXPORT", label: "Stunden exportieren" }, { key: "HOURS_CLOSE", label: "Monate schließen" }, { key: "HOURS_REOPEN", label: "Monate wieder öffnen" }, { key: "CUSTOMERS_VIEW", label: "Kunden ansehen" }, { key: "CUSTOMERS_EDIT", label: "Kunden bearbeiten" }] },
  { label: "System", items: [{ key: "SETTINGS_VIEW", label: "Einstellungen ansehen" }, { key: "SETTINGS_EDIT", label: "Einstellungen ändern" }] },
] as const;

export function RolesSettingsClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = React.useState(initial);
  const [saving, setSaving] = React.useState<string[]>([]);
  const value = (role: string, permission: string) => rows.find(row => row.role === role && row.permission === permission) ?? { role, permission, canView: false, canManage: false };
  async function save(next: Row) {
    const key = `${next.role}:${next.permission}`;
    const previous = value(next.role, next.permission);
    setSaving(keys => [...keys, key]);
    setRows(all => [...all.filter(row => !(row.role === next.role && row.permission === next.permission)), next]);
    try {
      const response = await fetch("/api/settings/roles", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error("Speichern fehlgeschlagen");
    } catch {
      setRows(all => [...all.filter(row => !(row.role === next.role && row.permission === next.permission)), previous]);
      notify("Berechtigung konnte nicht gespeichert werden. Bitte erneut versuchen.");
    } finally { setSaving(keys => keys.filter(item => item !== key)); }
  }
  return <Card title="Rollen & Berechtigungen" description="Jede Aktion kann je Rolle einzeln freigegeben werden. Änderungen werden sofort gespeichert.">
    <p className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm">
      Sehen steuert den Zugriff auf Informationen. Ändern erlaubt die jeweilige Aktion. Die Admin-Sicherheitsregeln bleiben unveränderbar aktiv.
    </p>
    <div className="space-y-6">{groups.map(group => <section key={group.label}>
      <h3 className="mb-3 text-sm font-semibold text-[color:var(--accent)]">{group.label}</h3>
      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">{group.items.map(item =>
        <fieldset key={item.key} className="p-4">
          <legend className="sr-only">{item.label}</legend>
          <p className="mb-3 text-sm font-semibold">{item.label}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{roles.map(role => {
            const row = value(role.key, item.key);
            return <div key={role.key} className="rounded-xl bg-[var(--surface-2)] p-3">
              <p className="mb-1 text-xs font-semibold">{role.label}</p>
              <div className="flex flex-wrap gap-x-4">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" disabled={saving.includes(`${row.role}:${row.permission}`)} aria-label={role.label + ': ' + item.label + ' – Sehen'} checked={row.canView} onChange={event => void save({ ...row, canView: event.target.checked })} />Sehen
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" disabled={saving.includes(`${row.role}:${row.permission}`)} aria-label={role.label + ': ' + item.label + ' – Ändern'} checked={row.canManage} onChange={event => void save({ ...row, canManage: event.target.checked })} />Ändern
                </label>
              </div>
            </div>;
          })}</div>
        </fieldset>)}</div>
    </section>)}</div>
  </Card>;
}
