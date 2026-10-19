import { dateFormatter } from "@/lib/date-format";
import Link from "next/link";
import { Badge, Card } from "../_components/ui";

const format = (value: unknown) => value ? dateFormatter({ dateStyle: "short", timeStyle: "short" }).format(new Date(value as string)) : "—";
const statusStyle: Record<string, string> = {
  FREE: "border-l-[7px] border-l-[var(--success)] bg-[linear-gradient(110deg,color-mix(in_oklab,var(--success)_5%,var(--surface))_0%,var(--surface)_48%)]",
  PLANNED: "border-l-[7px] border-l-[var(--warning)] bg-[linear-gradient(110deg,color-mix(in_oklab,var(--warning)_8%,var(--surface))_0%,var(--surface)_48%)]",
  IN_USE: "border-l-[7px] border-l-[var(--danger)] bg-[linear-gradient(110deg,color-mix(in_oklab,var(--danger)_7%,var(--surface))_0%,var(--surface)_48%)]",
};
const statusLabel: Record<string, string> = { FREE: "Frei", PLANNED: "Heute eingeplant", IN_USE: "Im Einsatz" };
export type Vehicle = { id: number; licensePlate: string; type: string; mileage: number; location: string; tuvLastAt: Date | string | null; isActive: boolean; booking: { status: string; title?: string; startAt?: Date | string; endAt?: Date | string | null } };

export function VehicleOverview({ data, canManage, onCreate }: { data: { vehicles: Vehicle[] }; canManage: boolean; onCreate: () => void }) {
  const active = data.vehicles.filter((vehicle) => vehicle.isActive);
  const inactive = data.vehicles.filter((vehicle) => !vehicle.isActive);
  const card = (v: Vehicle, isInactive = false) => {
    const status = v.booking?.status ?? "FREE";
    const times = v.booking?.startAt ? `${format(v.booking.startAt)}${v.booking.endAt ? ` – ${format(v.booking.endAt)}` : ""}` : null;
    return <Link href={`/vehicles/${v.id}`} key={v.id} className={isInactive ? "" : ""}><Card className={`${isInactive ? "border-l-[7px] border-l-amber-500 bg-amber-50/70" : statusStyle[status] ?? statusStyle.FREE} relative overflow-hidden shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)]`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-lg font-bold tracking-tight">{v.licensePlate}</p><p className="mt-0.5 text-sm text-[color:var(--muted)]">{v.type} · {v.location || "Standardstandort"}</p></div><Badge tone={isInactive ? "warning" : status === "IN_USE" ? "danger" : status === "PLANNED" ? "warning" : "success"}>{isInactive ? "S6 · Nicht einsatzbereit" : statusLabel[status] ?? "Frei"}</Badge></div><div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--border)]/70 pt-3"><div className="min-w-0">{!isInactive && status !== "FREE" ? <><p className="truncate text-xs font-semibold">{v.booking?.title ?? "Dienst"}</p><p className="mt-0.5 text-xs text-[color:var(--muted)]">{status === "IN_USE" ? "Dienst läuft" : "Beginn heute"}{times ? ` · ${times}` : ""}</p></> : <p className="text-xs text-[color:var(--muted)]">{isInactive ? "Vorübergehend nicht verfügbar" : "Kein Dienst heute eingeplant"}</p>}</div><p className="shrink-0 text-xs font-semibold text-[color:var(--muted)]">{Number(v.mileage).toLocaleString("de-DE")} km <span className="font-normal">· TÜV {format(v.tuvLastAt)}</span></p></div></Card></Link>;
  };
  return <div className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-3 text-xs font-medium text-[color:var(--muted)]"><span>● Frei</span><span className="text-amber-600">● Heute geplant</span><span className="text-red-600">● Im Einsatz</span></div>{canManage ? <button onClick={onCreate} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">+ Fahrzeug erstellen</button> : null}</div>
    <section><div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-bold">Im Dienst</h2><span className="text-sm text-[color:var(--muted)]">{active.length} Fahrzeuge</span></div>{active.length ? <div className="grid gap-4 lg:grid-cols-2">{active.map((v) => card(v))}</div> : <Card><p className="text-sm text-[color:var(--muted)]">Keine aktiven Fahrzeuge vorhanden.</p></Card>}</section>
    {inactive.length ? <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5"><div className="mb-3 flex items-baseline justify-between"><div><h2 className="text-lg font-bold text-amber-950">Nicht einsatzbereit</h2><p className="mt-1 text-xs text-amber-900/70">S6 · Vorübergehend außer Dienst · Historie bleibt erhalten</p></div><span className="text-sm font-semibold text-amber-900">{inactive.length}</span></div><div className="grid gap-4 lg:grid-cols-2">{inactive.map((v) => card(v, true))}</div></section> : null}
  </div>;
}
