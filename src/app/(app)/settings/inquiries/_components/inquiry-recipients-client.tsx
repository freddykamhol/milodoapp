"use client";

import { RecipientSelector } from "@/app/_components/recipient-selector";
import { notify } from "@/app/_components/feedback";
import * as React from "react";
import { Card } from "../../../_components/ui";

type Mode = "eh" | "notfall" | "sanitaet" | "boerse" | "kontakt";
type Role = "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
type User = { id: number; username: string; email: string; role: Role };
type Recipient = { type: "ROLE" | "USER" | "EMAIL"; role?: Role | null; userId?: number | null; email?: string | null; originMode?: Mode | null };
type Row = { mode: Mode; label: string; description: string; recipients: Recipient[] };

function RecipientEditor({row,users,onSave,isEmailGlobal,onToggleEmailGlobal,saving}:{row:Row;users:User[];onSave:(recipients:Recipient[])=>void;isEmailGlobal:(email:string)=>boolean;onToggleEmailGlobal:(email:string,checked:boolean,source:Mode)=>void;saving:boolean}){

   const initial=row.recipients??[];
   return <div className="mt-4"><RecipientSelector disabled={saving} users={users} value={{roles:initial.flatMap(item=>item.type==='ROLE'&&item.role?[item.role]:[]),userIds:initial.flatMap(item=>item.type==='USER'&&item.userId?[item.userId]:[]),emails:initial.flatMap(item=>item.type==='EMAIL'&&item.email?[item.email]:[])}} onChange={value=>{onSave([...value.roles.map(role=>({type:'ROLE' as const,role})),...value.userIds.map(userId=>({type:'USER' as const,userId})),...value.emails.map(email=>({type:'EMAIL' as const,email,originMode:initial.find(item=>item.type==='EMAIL'&&item.email===email)?.originMode??row.mode}))]); }} emailExtra={email=><label className="flex min-h-9 shrink-0 items-center gap-1" title="Für alle Bereiche übernehmen"><input type="checkbox" aria-label="Für alle Bereiche übernehmen" checked={isEmailGlobal(email)} disabled={saving} onChange={event=>void onToggleEmailGlobal(email,event.target.checked,row.mode)}/><span>Alle</span></label>}/></div>;
  }

export function InquiryRecipientsClient({ initial, users }: { initial: Row[]; users: User[] }) {
  const [rows, setRows] = React.useState(initial);
  const [saving, setSaving] = React.useState<Mode | "ALL" | null>(null);

  function isEmailGlobal(email: string) {
    return rows.every((row) => row.recipients.some((recipient) => recipient.type === "EMAIL" && recipient.email === email));
  }

  async function toggleEmailGlobal(email: string, checked: boolean, sourceMode: Mode) {
    if (saving) return;
    const nextRows = rows.map((row) => {
      const current = row.recipients;
      const existing = current.find((recipient) => recipient.type === "EMAIL" && recipient.email === email);
      const originMode = existing?.originMode ?? sourceMode;
      const withoutEmail = current.filter((recipient) => !(recipient.type === "EMAIL" && recipient.email === email));
      const keepOrigin = !checked && originMode === row.mode;
      return { ...row, recipients: checked || keepOrigin ? [...withoutEmail, { type: "EMAIL" as const, email, originMode }] : withoutEmail };
    });
    setRows(nextRows);
    setSaving("ALL");
    try {
      const results = await Promise.all(nextRows.map(async (row) => {
        try {
          const response = await fetch("/api/settings/inquiry-recipients", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: row.mode, recipients: row.recipients }),
          });
          return { mode: row.mode, ok: response.ok };
        } catch {
          return { mode: row.mode, ok: false };
        }
      }));
      const failedModes = results.filter((result) => !result.ok).map((result) => result.mode);
      if (failedModes.length) {
        setRows((current) => current.map((row) => {
          if (!failedModes.includes(row.mode)) return row;
          const previous = rows.find((item) => item.mode === row.mode)!;
          return { ...row, recipients: previous.recipients };
        }));
        const names = failedModes.map((mode) => rows.find((row) => row.mode === mode)?.label ?? mode);
        notify(`Mindestens ein Empfänger muss ausgewählt bleiben. Nicht geändert wurden:\n${names.map((name) => `• ${name}`).join("\n")}`);
      }
    } finally {
      setSaving(null);
    }
  }

  async function save(mode: Mode, recipients: Recipient[]) {
    if (saving) return;
    const previous = rows.find((row) => row.mode === mode)?.recipients ?? [];
    setRows((current) => current.map((row) => row.mode === mode ? { ...row, recipients } : row));
    setSaving(mode);
    try {
      const response = await fetch("/api/settings/inquiry-recipients", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, recipients }) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Speichern fehlgeschlagen.");
    } catch (error) {
      setRows((current) => current.map((row) => row.mode === mode ? { ...row, recipients: previous } : row));
      const label = rows.find((row) => row.mode === mode)?.label ?? mode;
      const detail = error instanceof Error && error.message === "recipient_required"
        ? "Mindestens ein Empfänger muss ausgewählt bleiben."
        : "Die Änderung konnte nicht gespeichert werden.";
      notify(`${detail}\nBetroffene Anfrageart: ${label}`);
    } finally {
      setSaving(null);
    }
  }

  return <Card title="Empfänger je Anfrageart" description="Neue Website-Anfragen werden an die ausgewählten Rollen, Benutzer und zusätzlichen Adressen gesendet.">
    <div className="grid grid-cols-1 gap-4">{rows.map((row) => <section key={row.mode} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{row.label}</h3><p className="mt-1 text-xs text-[color:var(--muted)]">{row.description}</p></div>{saving === row.mode || saving === "ALL" ? <span className="text-xs font-semibold text-[color:var(--muted)]">Speichert …</span> : null}</div><RecipientEditor row={row} users={users} saving={saving === row.mode || saving === "ALL"} isEmailGlobal={isEmailGlobal} onToggleEmailGlobal={toggleEmailGlobal} onSave={(recipients) => void save(row.mode, recipients)} /></section>)}</div>
  </Card>;
}
