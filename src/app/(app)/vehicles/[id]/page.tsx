import {DefectAppointmentsPanel} from "../../_components/defect-appointments";
import {loadDefectAppointments} from "@/lib/defect-appointments";
import { dateFormatter } from "@/lib/date-format";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AppShell } from "../../_components/app-shell";
import { DefectOverview } from "../../_components/defects";
import { vehicleDefectCategories } from "@/lib/defects";
import { Card, Badge } from "../../_components/ui";
import { db } from "@/lib/db";
import { vehicleDefects, vehicles, vehicleMaintenances, vehicleMaintenanceAppointments, vehicleServiceCompanies, vehicleTrips } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { MaintenanceForm } from "./maintenance-form";
import { MaintenanceAppointmentsList, MaintenanceIntervalActions } from "./maintenance-interval-actions";
import { VehicleLifecycleActions } from "./vehicle-lifecycle-actions";

export default async function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login"); if(viewer.role==="KUNDE")redirect("/dashboard");
  if (viewer.role === "PERSONAL") notFound();
  const canManage = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const id = Number((await params).id);
  const v = await db.query.vehicles.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!v) notFound();
  const [defects, trips, maintenance, appointments, companies, mangelAppointments] = await Promise.all([
    db.select().from(vehicleDefects).where(eq(vehicleDefects.vehicleId, id)),
    db.select().from(vehicleTrips).where(eq(vehicleTrips.vehicleId, id)),
    db.select().from(vehicleMaintenances).where(eq(vehicleMaintenances.vehicleId, id)),
    db.select().from(vehicleMaintenanceAppointments).where(eq(vehicleMaintenanceAppointments.vehicleId, id)),
    db.select({ id: vehicleServiceCompanies.id, name: vehicleServiceCompanies.name, address: vehicleServiceCompanies.address }).from(vehicleServiceCompanies),
    loadDefectAppointments({domain:"vehicle",assetId:id}),
  ]);
  const date = (value: Date | null) => value ? dateFormatter().format(value) : "—";
  const tuvNextAt = v.tuvLastAt ? new Date(v.tuvLastAt.getTime() + 2 * 365 * 86400000) : null;
  return <AppShell title={v.licensePlate} subtitle={`${v.type} · Fahrzeugdetails`}><div className="space-y-4">
    {!v.isActive ? <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">S6 · Nicht einsatzbereit. Neue Fahrten und Dienstzuordnungen sind gesperrt.</div> : null}
    {canManage ? <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Fahrzeugverwaltung</p><p className="mt-1 text-xs text-[color:var(--muted)]">Einsatzbereitschaft ändern oder Fahrzeug endgültig entfernen.</p></div><VehicleLifecycleActions vehicleId={v.id} licensePlate={v.licensePlate} isActive={v.isActive} /></div></Card> : null}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Card><p className="text-xs text-[color:var(--muted)]">Kilometerstand</p><p className="mt-1 text-2xl font-semibold">{v.mileage.toLocaleString("de-DE")} km</p></Card><Card><p className="text-xs text-[color:var(--muted)]">Standort</p><p className="mt-1 text-lg font-semibold">{v.location || "Standard"}</p></Card><Card><p className="text-xs text-[color:var(--muted)]">Offene Mängel</p><p className="mt-1 text-2xl font-semibold">{defects.filter((d) => d.status !== "BEHOBEN").length}</p></Card><Card><p className="text-xs text-[color:var(--muted)]">TÜV zuletzt</p><p className="mt-1 text-lg font-semibold">{date(v.tuvLastAt)}</p></Card></div>
    <DefectOverview compact rows={defects.map(d=>({id:d.id,title:d.title,status:d.status,createdAt:d.createdAt,subject:v.licensePlate,category:vehicleDefectCategories[d.category],href:`/vehicles/defects/${d.id}`}))} createHref={`/vehicles/defects/new?vehicleId=${id}`}/>
    <DefectAppointmentsPanel domain="vehicle" assetId={id} initialAppointments={mangelAppointments} companies={companies} canManage={canManage}/>
    <Card title="Fahrtenbuch"><div className="space-y-2">{trips.length ? trips.map((t) => <div key={t.id} className="flex justify-between border-b border-[var(--border)] py-2 text-sm"><span className="font-semibold">{t.title}</span><span>{t.kmStart} → {t.kmEnd} km</span></div>) : <p className="text-sm text-[color:var(--muted)]">Noch keine Einträge.</p>}</div></Card>
    <Card title="Wartungsintervalle"><div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">TÜV-Prüfung</p><p className="text-xs text-[color:var(--muted)]">Letzte Prüfung: {date(v.tuvLastAt)}</p></div><div className="flex flex-wrap items-center gap-2"><Badge tone={tuvNextAt && tuvNextAt < new Date() ? "danger" : "success"}>Nächste: {date(tuvNextAt)}</Badge>{canManage ? <MaintenanceIntervalActions maintenance={{ id: "tuv", title: "TÜV-Prüfung", intervalDays: 730, lastAt: v.tuvLastAt, nextAt: tuvNextAt }} vehicleId={id} licensePlate={v.licensePlate} companies={companies} /> : null}</div></div><MaintenanceAppointmentsList appointments={appointments.filter((appointment) => appointment.maintenanceId === null)} companies={companies} canManage={canManage} /></div>
      {maintenance.map((m) => <div key={m.id} className="rounded-xl border border-[var(--border)] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{m.title}</p><p className="text-xs text-[color:var(--muted)]">Letzte Wartung: {date(m.lastAt)} · Intervall: {m.intervalDays} Tage</p></div><div className="flex flex-wrap items-center gap-2"><Badge tone={m.nextAt < new Date() ? "danger" : "success"}>Nächste: {date(m.nextAt)}</Badge>{canManage ? <MaintenanceIntervalActions maintenance={m} vehicleId={id} licensePlate={v.licensePlate} companies={companies} /> : null}</div></div><MaintenanceAppointmentsList appointments={appointments.filter((appointment) => appointment.maintenanceId === m.id)} companies={companies} canManage={canManage} /></div>)}
      {canManage ? <MaintenanceForm vehicleId={v.id} /> : null}</div></Card>
  </div></AppShell>;
}
