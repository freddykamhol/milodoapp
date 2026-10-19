"use client";

import { AppSelect } from "@/app/_components/select";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "../../../_components/ui";

const statuses = [{ value: "ERSTELLT", label: "Erstellt" }, { value: "IN_BEARBEITUNG", label: "In Bearbeitung" }, { value: "BEHOBEN", label: "Behoben" }];
export function DefectStatusControl({ defectId, initialStatus, canManage }: { defectId: number; initialStatus: string; canManage: boolean }) {
  const router = useRouter(); const [status, setStatus] = React.useState(initialStatus); const [saving, setSaving] = React.useState(false); const [error, setError] = React.useState("");
  const tone = status === "BEHOBEN" ? "success" : status === "IN_BEARBEITUNG" ? "warning" : "accent";
  async function change(value: string) { const previous = status; setStatus(value); setSaving(true); setError(""); try { const response = await fetch(`/api/vehicles/defects/${defectId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: value }) }); if (!response.ok) throw new Error((await response.json()).error ?? "Status konnte nicht gespeichert werden."); router.refresh(); } catch (e) { setStatus(previous); setError(e instanceof Error ? e.message : "Status konnte nicht gespeichert werden."); } finally { setSaving(false); } }
  return <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">Bearbeitungsstatus</p>{canManage ? <><label className="sr-only" htmlFor="defect-status">Status ändern</label><AppSelect id="defect-status" disabled={saving} value={status} onChange={(e) => void change(e.target.value)} className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[var(--ring)] disabled:opacity-60">{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</AppSelect><p className="mt-2 text-xs text-[color:var(--muted)]">{saving ? "Wird gespeichert …" : "Änderungen werden direkt übernommen."}</p>{error ? <p role="alert" className="mt-2 text-xs font-semibold text-[color:var(--danger)]">{error}</p> : null}</> : <Badge tone={tone}>{statuses.find((item) => item.value === status)?.label ?? status}</Badge>}</div>;
}
