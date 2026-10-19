"use client";

import * as React from "react";
import { AppSelect } from "@/app/_components/select";
import { notify } from "@/app/_components/feedback";
import { Badge, Card } from "../_components/ui";
import { courseType } from "@/lib/course-types";
import { dateFormatter } from "@/lib/date-format";

type Application = { userId: number; username: string; role: string; qualRD: string | null; qualAusb: string | null; status: "REPORTED" | "CONFIRMED" | "CANCELLED"; appRole: "NORMAL" | "EL"; adminNote: string };
type Member = { id: number; username: string; role: string; qualRD: string | null; qualAusb: string | null; locked: boolean };
type CourseSummary = { title: string; startAt: string; endAt: string | null; location: string; courseType: string | null; state: string; approved: boolean; staffingStatus: string };
const qualifications = (row: { qualRD: string | null; qualAusb: string | null }) => [row.qualRD && `RD: ${row.qualRD}`, row.qualAusb && `Ausb: ${row.qualAusb}`].filter(Boolean).join(" · ") || "Keine Qualifikation hinterlegt";
const formatDateTime = (value: string) => dateFormatter({ weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const formatTimeRange = (start: string, end: string | null) => end ? `${dateFormatter({ hour: "2-digit", minute: "2-digit" }).format(new Date(start))}–${dateFormatter({ hour: "2-digit", minute: "2-digit" }).format(new Date(end))}` : dateFormatter({ hour: "2-digit", minute: "2-digit" }).format(new Date(start));

export function CourseStaffing({ courseId, canOperate, canStaff, course }: { courseId: number; canOperate: boolean; canStaff: boolean; course: CourseSummary }) {
  const [applications, setApplications] = React.useState<Application[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [viewerApplication, setViewerApplication] = React.useState<Application | null>(null);
  const [canReport, setCanReport] = React.useState(false);
  const [canAdmin, setCanAdmin] = React.useState(false);
  const [selected, setSelected] = React.useState("");
  const [role, setRole] = React.useState<"NORMAL" | "EL">("NORMAL");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    const response = await fetch(`/api/courses/${courseId}/staffing`, { cache: "no-store" });
    if (!response.ok) throw new Error("Personal konnte nicht geladen werden.");
    const data = await response.json();
    setApplications(data.applications); setMembers(data.members); setViewerApplication(data.viewerApplication); setCanReport(Boolean(data.canReport)); setCanAdmin(Boolean(data.canAdmin));
  }, [courseId]);
  React.useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Verbindungsfehler.")); }, [load]);

  const confirmed = applications.filter((item) => item.status === "CONFIRMED").sort((a, b) => (b.appRole === "EL" ? 1 : 0) - (a.appRole === "EL" ? 1 : 0) || a.username.localeCompare(b.username));
  const reported = applications.filter((item) => item.status === "REPORTED");
  async function action(url: string, body: unknown, method = "POST") {
    setBusy(true); setError("");
    try { const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Aktion fehlgeschlagen."); await load(); setSelected(""); notify("Personalverwaltung aktualisiert."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Verbindungsfehler."); }
    finally { setBusy(false); }
  }

  if (!canStaff) return null;

  if (!canAdmin) {
    const courseStatus = course.state === "CANCELLED" ? "Abgesagt" : course.state === "CLOSED" ? "Abgeschlossen" : course.approved ? "OPEN" : "Freigabe ausstehend";
    return <div id="personalverwaltung" className="scroll-mt-6"><Card title="Übersicht" description="Alle Informationen zum Kurs auf einen Blick." actions={<div className="flex flex-wrap items-center gap-2"><Badge tone={course.state === "CANCELLED" ? "danger" : "accent"}>{courseStatus}</Badge><Badge tone="muted">{course.staffingStatus}</Badge><Badge tone="accent">Ausb: AUSBILDER</Badge></div>}>
      {canReport ? <button type="button" className="ui-button-primary mb-4 w-full justify-center py-3 text-sm" disabled={busy} onClick={() => void action(`/api/appointments/${courseId}/report`, {})}>Melden</button> : viewerApplication?.status === "REPORTED" ? <div className="mb-4 flex flex-wrap items-center gap-3"><Badge tone="warning">Bereits gemeldet</Badge><button type="button" className="ui-button-secondary text-[color:var(--danger)]" disabled={busy} onClick={() => void action(`/api/appointments/${courseId}/report`, {}, "DELETE")}>Meldung zurücknehmen</button></div> : viewerApplication?.status === "CONFIRMED" ? <div className="mb-4"><Badge tone="success">Bereits eingeteilt</Badge></div> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"><p className="text-xs font-semibold text-[color:var(--muted)]">Zeit</p><p className="mt-1 text-sm font-semibold">{formatDateTime(course.startAt)}</p><p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{formatTimeRange(course.startAt, course.endAt)}</p></div><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"><p className="text-xs font-semibold text-[color:var(--muted)]">Bereich</p><p className="mt-1 text-sm font-semibold">Erste-Hilfe-Ausbildung</p><p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{courseType(course.courseType)?.label ?? "Kurs"}</p></div><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:col-span-2"><p className="text-xs font-semibold text-[color:var(--muted)]">Titel</p><p className="mt-1 text-sm font-semibold">{course.title}</p><p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{course.location}</p></div></div>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-[color:var(--danger)]">{error}</p> : null}
    </Card></div>;
  }

  return <div id="personalverwaltung" className="scroll-mt-6 space-y-6"><Card title="Personalverwaltung" description="Helfer direkt für diesen Kurs einteilen oder wieder austragen."><div className="flex flex-col gap-3 md:flex-row md:items-end"><label className="block md:flex-1"><span className="text-xs font-semibold text-[color:var(--muted)]">Mitglied</span><AppSelect className="mt-1 w-full" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={busy}><option value="">Mitglied auswählen</option>{members.filter((member) => member.role !== "KUNDE" && !applications.some((app) => app.userId === member.id && app.status === "CONFIRMED")).map((member) => <option key={member.id} value={member.id}>{member.username} · {qualifications(member)}</option>)}</AppSelect></label><label className="block"><span className="text-xs font-semibold text-[color:var(--muted)]">Rolle</span><AppSelect className="mt-1" value={role} onChange={(event) => setRole(event.target.value as "NORMAL" | "EL")} disabled={busy}><option value="NORMAL">Helfer</option><option value="EL">Einsatzleitung</option></AppSelect></label><button type="button" className="ui-button-primary" disabled={!selected || busy} onClick={() => void action(`/api/courses/${courseId}/admin/assign`, { userId: Number(selected), role })}>Einteilen</button></div>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-[color:var(--danger)]">{error}</p> : null}</Card><Card title="Eingeteilt" description={`${confirmed.length} Personen für diesen Kurs`}><div className="space-y-2">{confirmed.length ? confirmed.map((item) => <div key={item.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"><div><p className="text-sm font-semibold">{item.username} {item.appRole === "EL" ? <Badge tone="warning">EL</Badge> : null}</p><p className="mt-1 text-xs text-[color:var(--muted)]">{qualifications(item)}</p></div><button type="button" className="ui-button-secondary text-[color:var(--danger)]" disabled={busy} onClick={() => void action(`/api/courses/${courseId}/admin/unassign`, { userId: item.userId })}>Austragen</button></div>) : <p className="text-sm text-[color:var(--muted)]">Noch niemand eingeteilt.</p>}</div></Card><Card title="Meldungen" description="Personal, das sich für den Kurs gemeldet hat."><div className="space-y-2">{reported.length ? reported.map((item) => <div key={item.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"><div><p className="text-sm font-semibold">{item.username}</p><p className="mt-1 text-xs text-[color:var(--muted)]">{qualifications(item)}</p></div><button type="button" className="ui-button-primary" disabled={busy} onClick={() => void action(`/api/courses/${courseId}/admin/assign`, { userId: item.userId, role: "NORMAL" })}>Einteilen</button></div>) : <p className="text-sm text-[color:var(--muted)]">Keine offenen Meldungen.</p>}</div></Card></div>;
}
