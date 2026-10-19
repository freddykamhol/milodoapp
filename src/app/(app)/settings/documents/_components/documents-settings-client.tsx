"use client";

import { RecipientSelector } from "@/app/_components/recipient-selector";
import { notify } from "@/app/_components/feedback";
import * as React from "react";
import { Card } from "../../../_components/ui";

type Category = "TRAINING" | "DRIVER_LICENSE" | "QUALIFICATION";
type Role = "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
type User = { id: number; username: string; email: string; role: Role };
type Recipient = { type: "ROLE" | "USER" | "EMAIL"; role?: Role | null; userId?: number | null; email?: string | null; originCategory?: Category | null };
type Row = { category: Category; label: string; expiryMonths?: number; reminderDaysBefore?: number; recipients?: Recipient[] };
function Check({checked}:{checked:boolean}){return <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked?'border-[var(--accent)] bg-[var(--accent)] text-white':'border-[var(--border)]'}`}>{checked?'✓':''}</span>;}

function RecipientEditor({row,users,onSave,isEmailGlobal,onToggleEmailGlobal}:{row:Row;users:User[];onSave:(recipients:Recipient[])=>Promise<void>;isEmailGlobal:(email:string)=>boolean;onToggleEmailGlobal:(email:string,checked:boolean,source:Category)=>Promise<void>}){
   const [saving,setSaving]=React.useState(false);
   const initial=row.recipients??[];
   return <div className="mt-4"><RecipientSelector disabled={saving} users={users} value={{roles:initial.flatMap(item=>item.type==='ROLE'&&item.role?[item.role]:[]),userIds:initial.flatMap(item=>item.type==='USER'&&item.userId?[item.userId]:[]),emails:initial.flatMap(item=>item.type==='EMAIL'&&item.email?[item.email]:[])}} onChange={async value=>{setSaving(true);try{await onSave([...value.roles.map(role=>({type:'ROLE' as const,role})),...value.userIds.map(userId=>({type:'USER' as const,userId})),...value.emails.map(email=>({type:'EMAIL' as const,email,originCategory:initial.find(item=>item.type==='EMAIL'&&item.email===email)?.originCategory??row.category}))]);}finally{setSaving(false);} }} emailExtra={email=><label className="flex min-h-9 shrink-0 items-center gap-1" title="Für alle Bereiche übernehmen"><input type="checkbox" aria-label="Für alle Bereiche übernehmen" checked={isEmailGlobal(email)} disabled={saving} onChange={event=>void onToggleEmailGlobal(email,event.target.checked,row.category)}/><span>Alle</span></label>}/></div>;
  }

export function DocumentsSettingsClient({ initial, users, manualExpiryRequiresApproval: initialApproval }: { initial: Row[]; users: User[]; manualExpiryRequiresApproval: boolean }) {
  const [rows, setRows] = React.useState(initial.map((row) => ({ ...row, expiryMonths: row.expiryMonths ?? 0, reminderDaysBefore: row.reminderDaysBefore ?? 0 })));
  const [manualExpiryRequiresApproval, setManualExpiryRequiresApproval] = React.useState(initialApproval);
  const [saving, setSaving] = React.useState<Category | null>(null);
  async function save(row: Row, recipients?: Recipient[]) {
    const previous = rows.find(item=>item.category===row.category)?.recipients;
    if(recipients)setRows(current=>current.map(item=>item.category===row.category?{...item,recipients}:item));
    setSaving(row.category);
    try {
      const response=await fetch("/api/settings/documents",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({...row,recipients})});
      if(!response.ok)throw new Error('Die Einstellung konnte nicht gespeichert werden.');
    } catch(error) {
      if(recipients)setRows(current=>current.map(item=>item.category===row.category?{...item,recipients:previous}:item));
      notify(error instanceof Error?error.message:'Speichern fehlgeschlagen.');
    } finally {setSaving(null);}
  }
  function isEmailGlobal(email: string) { return rows.every((row) => row.recipients?.some((recipient) => recipient.type === "EMAIL" && recipient.email === email)); }
  async function toggleEmailGlobal(email: string, checked: boolean, sourceCategory: Category) { const nextRows = rows.map((row) => { const current = row.recipients ?? []; const existing = current.find((recipient) => recipient.type === "EMAIL" && recipient.email === email); const originCategory = existing?.originCategory ?? sourceCategory; const withoutEmail = current.filter((recipient) => !(recipient.type === "EMAIL" && recipient.email === email)); const keepOriginal = !checked && originCategory === row.category; return { ...row, recipients: checked || keepOriginal ? [...withoutEmail, { type: "EMAIL" as const, email, originCategory }] : withoutEmail }; }); setRows(nextRows); await Promise.all(nextRows.map((row) => save(row, row.recipients))); }
  return <Card title="Dokumentenablauf" description="Systemweite Regeln. 0 bedeutet kein Ablauf bzw. keine Erinnerung."><div className="space-y-4"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-4"><label className="group flex cursor-pointer items-start gap-3 rounded-xl focus-within:ring-2 focus-within:ring-[color:var(--ring)]"><input type="checkbox" className="sr-only" checked={manualExpiryRequiresApproval} onChange={async (event) => { const checked = event.target.checked; setManualExpiryRequiresApproval(checked); const response = await fetch("/api/settings/documents", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ manualExpiryRequiresApproval: checked }) }); if (!response.ok) { setManualExpiryRequiresApproval(!checked); notify("Einstellung konnte nicht gespeichert werden."); } }} /><Check checked={manualExpiryRequiresApproval} /><span><span className="block text-sm font-semibold">Manuelles Ablaufdatum genehmigungspflichtig</span><span className="mt-1 block text-xs text-[color:var(--muted)]">Bei Aktivierung bleibt das manuelle Datum bis zur Freigabe durch Verwaltung oder Admin ausstehend.</span></span></label></section>{rows.map((row) => <section key={row.category} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4"><div className="flex flex-col gap-3"><div><p className="text-sm font-semibold">{row.label}</p><p className="mt-1 text-xs text-[color:var(--muted)]">Ablauf und Mail-Erinnerung konfigurieren</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-[color:var(--muted)]">Ablauf in Monaten<input type="number" min="0" max="1200" value={row.expiryMonths} disabled={saving === row.category} onChange={(e) => setRows((current) => current.map((item) => item.category === row.category ? { ...item, expiryMonths: Number(e.target.value) } : item))} onBlur={() => void save(row)} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[color:var(--foreground)]" /></label><label className="text-xs font-semibold text-[color:var(--muted)]">Erinnerung in Tagen<input type="number" min="0" max="3650" value={row.reminderDaysBefore} disabled={saving === row.category} onChange={(e) => setRows((current) => current.map((item) => item.category === row.category ? { ...item, reminderDaysBefore: Number(e.target.value) } : item))} onBlur={() => void save(row)} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[color:var(--foreground)]" /></label></div></div><RecipientEditor row={row} users={users} isEmailGlobal={isEmailGlobal} onToggleEmailGlobal={toggleEmailGlobal} onSave={(recipients) => save(row, recipients)} /></section>)}</div></Card>;
}


















