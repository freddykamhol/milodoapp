"use client";

import * as React from "react";
import Link from "next/link";
import { Card, Badge } from "../_components/ui";
import { Pagination, usePagedItems } from "../_components/pagination";
import { courseType } from "@/lib/course-types";
import { dateFormatter } from "@/lib/date-format";

type Row = { id: number; title: string; courseType: string | null; participantLimit: number | null; startAt: string; endAt: string | null; location: string; customerName: string; state: string; approved: boolean; registered: number; present: number };
type StatusKey = "all" | "planned" | "pending" | "completed" | "cancelled";

function statusOf(row: Row): StatusKey {
  if (row.state === "CANCELLED") return "cancelled";
  if (row.state === "CLOSED") return "completed";
  if (!row.approved) return "pending";
  return "planned";
}
function statusLabel(row: Row) { const status = statusOf(row); return status === "cancelled" ? "Abgesagt" : status === "completed" ? "Abgeschlossen" : status === "pending" ? "Freigabe ausstehend" : "Geplant"; }
function statusTone(row: Row) { const status = statusOf(row); return status === "cancelled" ? "danger" : status === "completed" ? "muted" : status === "pending" ? "warning" : "success"; }

function MetricCard({ label, value, change, tone }: { label: string; value: string; change: string; tone: "accent" | "success" | "warning" | "danger" }) {
  return <Card><div className="flex min-h-[74px] flex-col justify-between gap-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs font-semibold text-[color:var(--muted)]">{label}</p><Badge tone={tone}>{change}</Badge></div><p className="text-2xl font-semibold tracking-tight">{value}</p></div></Card>;
}

export function CourseList({ rows }: { rows: Row[] }) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusKey>("all");
  const counts = React.useMemo(() => ({ all: rows.length, planned: rows.filter((row) => statusOf(row) === "planned").length, pending: rows.filter((row) => statusOf(row) === "pending").length, completed: rows.filter((row) => statusOf(row) === "completed").length, cancelled: rows.filter((row) => statusOf(row) === "cancelled").length }), [rows]);
  const filtered = rows.filter((row) => { const text = [row.title, row.customerName, row.location, courseType(row.courseType)?.label].join(" ").toLocaleLowerCase("de"); return (status === "all" || statusOf(row) === status) && text.includes(search.toLocaleLowerCase("de")); });
  const paged = usePagedItems(filtered, `${search}:${status}`);
  const tabs: Array<{ key: StatusKey; label: string }> = [{ key: "all", label: "Alle" }, { key: "planned", label: "Geplant" }, { key: "pending", label: "Freigabe ausstehend" }, { key: "completed", label: "Abgeschlossen" }, { key: "cancelled", label: "Abgesagt" }];

  return <div className="space-y-4">
    <section className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Alle Kurse" value={String(counts.all)} change="Übersicht" tone="accent" />
      <MetricCard label="Geplant" value={String(counts.planned)} change="freigegeben" tone="success" />
      <MetricCard label="Freigabe offen" value={String(counts.pending)} change="prüfen" tone="warning" />
      <MetricCard label="Abgeschlossen" value={String(counts.completed)} change="erledigt" tone="accent" />
      <MetricCard label="Abgesagt" value={String(counts.cancelled)} change="Status" tone="danger" />
    </section>
    <Card><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setStatus(tab.key)} className={["inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] px-3 py-2 text-xs font-semibold", status === tab.key ? "bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--foreground)]" : "bg-[var(--surface)] text-[color:var(--muted)] hover:bg-[var(--surface-2)]"].join(" ")}>{tab.label}<span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px]">{counts[tab.key]}</span></button>)}</div><label className="w-full text-xs font-semibold sm:w-72">Kurse durchsuchen<input type="search" className="ui-input mt-2 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kurs, Kunde oder Ort" /></label></div></Card>
    <Card><div className="space-y-3">{paged.items.map((row) => <Link key={row.id} href={`/courses/${row.id}`} className="block rounded-2xl border border-[var(--border)] p-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{row.title}</p><p className="mt-1 break-words text-sm text-[color:var(--muted)]">{courseType(row.courseType)?.label ?? "Kursart noch nicht hinterlegt"}</p></div><Badge tone={statusTone(row)}>{statusLabel(row)}</Badge></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><p>{dateFormatter({ dateStyle: "medium", timeStyle: "short" }).format(new Date(row.startAt))}</p><p className="break-words">{row.customerName}</p><p className="break-words">{row.location}</p><p>{row.registered} / {row.participantLimit ?? "–"} Teilnehmer · {row.present} anwesend</p></div></Link>)}</div>{!filtered.length ? <p className="py-6 text-sm text-[color:var(--muted)]">Keine Kurse gefunden.</p> : null}<Pagination {...paged} /></Card>
  </div>;
}
