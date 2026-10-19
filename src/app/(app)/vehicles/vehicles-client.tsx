"use client";
import { dateFormatter } from "@/lib/date-format";
import type { FleetFeed } from "@/lib/asset-types";
import { usePropState } from "@/app/_components/state";
import { useLiveRefresh } from "@/app/_components/use-live-refresh";
import * as React from "react";
import Link from "next/link";
import { AppSelect } from "@/app/_components/select";
import { Card } from "../_components/ui";
import { DefectList } from "./defects/_components/defect-list";
import { VehicleOverview } from "./vehicle-overview";

type Tab="vehicles"|"defects"|"trips"|"new";
type Data=FleetFeed;
const date=(value:string)=>dateFormatter({dateStyle:'short',timeStyle:'short'}).format(new Date(value));
export function VehiclesClient({role,initialTab='vehicles',initialData}:{role:string;initialTab?:Tab;showTabs?:boolean;initialData?:Data}){
 const view=role==='PERSONAL'&&initialTab==='vehicles'?'trips':initialTab;
 const [data,setData]=usePropState(initialData??null),[tab,setTab]=React.useState<Tab>(view),[error,setError]=React.useState('');
 const load=React.useCallback(async()=>{try{const response=await fetch(`/api/vehicles?view=${view==='new'?'vehicles':view}`);const result=await response.json();if(!response.ok)throw new Error(result.error??'Daten konnten nicht geladen werden.');setData(result);setError('');}catch(error){setError(error instanceof Error?error.message:'Laden fehlgeschlagen.');}},[view,setData]);
 React.useEffect(()=>{if(initialData)return;const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load,initialData]);
 useLiveRefresh(load,view==="vehicles"?60000:0);
 if(error)return <Card><p role="alert" className="text-sm text-[color:var(--danger)]">{error}</p><button className="ui-button-secondary mt-3" onClick={()=>void load()}>Erneut versuchen</button></Card>;
 if(!data)return <Card>Fahrzeugdaten werden geladen ...</Card>;
 if(tab==='new'&&data.canManage)return <VehicleForm onSaved={async()=>{await load();setTab('vehicles');}} onCancel={()=>setTab('vehicles')}/>;
 if(tab==='defects')return <DefectList defects={data.defects}/>;
 if(tab==='trips')return <Card title="Fahrtenbuch" actions={<Link className="ui-button-primary" href="/vehicles/trips/new">+ Fahrt erfassen</Link>}><div className="divide-y divide-[var(--border)]">{data.trips.map(row=><Link key={row.trip.id} href={`/vehicles/trips/${row.trip.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm transition hover:bg-[var(--surface-2)]"><div><p className="font-semibold">{row.trip.title}</p><p className="mt-1 text-xs text-[color:var(--muted)]">{row.vehicle.licensePlate} - {date(row.trip.startAt)}</p></div><p>{row.trip.kmStart.toLocaleString('de-DE')} → {row.trip.kmEnd.toLocaleString('de-DE')} km</p></Link>)}{!data.trips.length?<p className="py-4 text-sm text-[color:var(--muted)]">Noch keine Fahrten erfasst.</p>:null}</div></Card>;
 return <VehicleOverview data={data} canManage={data.canManage} onCreate={()=>setTab('new')}/>;
}
function VehicleForm({onSaved,onCancel}:{onSaved:()=>Promise<void>;onCancel:()=>void}){
 const [form,setForm]=React.useState({licensePlate:'',type:'PKW',initialMileage:'',tuvLastAt:'',location:'',notes:''}),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const normalized=form.licensePlate.toLocaleUpperCase('de-DE').replace(/[^A-Z0-9ÄÖÜ -]/g,'').replace(/\s+/g,' ').trim();
 const suggestion=normalized&&!normalized.includes('-')?normalized.replace(/^([A-ZÄÖÜ]{1,3})\s+([A-Z]{1,2})\s*(\d.*)$/,'$1-$2 $3'):normalized;
 async function save(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{if(suggestion!==normalized&&!normalized.includes('-')){setError('Bitte den Kennzeichenvorschlag übernehmen oder das Kennzeichen mit Bindestrich eingeben.');return;}const response=await fetch('/api/vehicles',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'vehicle',...form,licensePlate:normalized,initialMileage:Number(form.initialMileage),tuvLastAt:new Date(form.tuvLastAt).toISOString()})});const result=await response.json();if(!response.ok)throw new Error(result.error??'Fahrzeug konnte nicht angelegt werden.');await onSaved();}catch(error){setError(error instanceof Error?error.message:'Speichern fehlgeschlagen.');}finally{setBusy(false);}}
 return <Card title="Fahrzeug anlegen"><form className="grid gap-4 sm:grid-cols-2" onSubmit={save}><label className="text-xs font-semibold">Kennzeichen<input className="ui-input mt-1 uppercase" required value={form.licensePlate} onChange={event=>setForm({...form,licensePlate:event.target.value.toLocaleUpperCase('de-DE')})} placeholder="B-MD 100"/><span className="mt-1 block font-normal text-[color:var(--muted)]">Ortskürzel und Erkennungsnummer mit Bindestrich.</span>{suggestion!==normalized?<button className="mt-1 text-xs text-[color:var(--accent)]" type="button" onClick={()=>setForm({...form,licensePlate:suggestion})}>Vorschlag übernehmen: {suggestion}</button>:null}</label><label className="text-xs font-semibold">Fahrzeugtyp<AppSelect className="mt-1" value={form.type} onChange={event=>setForm({...form,type:event.target.value})}>{['PKW','MTW','KTW','RTW','S-KTW-S-RTW','ITW','NEF','LKW','SONSTIGE'].map(value=><option key={value} value={value}>{value==='SONSTIGE'?'Sonstige':value}</option>)}</AppSelect></label><label className="text-xs font-semibold">Kilometerstand<input className="ui-input mt-1" required type="number" min="0" value={form.initialMileage} onChange={event=>setForm({...form,initialMileage:event.target.value})}/></label><label className="text-xs font-semibold">Letzte TÜV-Prüfung<input className="ui-input mt-1" required type="date" value={form.tuvLastAt} onChange={event=>setForm({...form,tuvLastAt:event.target.value})}/></label><label className="text-xs font-semibold">Standort<input className="ui-input mt-1" value={form.location} onChange={event=>setForm({...form,location:event.target.value})}/></label><label className="text-xs font-semibold">Notizen<textarea className="ui-input mt-1" value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></label>{error?<p role="alert" className="text-sm text-[color:var(--danger)] sm:col-span-2">{error}</p>:null}<div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button className="ui-button-secondary" type="button" onClick={onCancel}>Abbrechen</button><button className="ui-button-primary" type="submit" disabled={busy}>{busy?'Wird gespeichert ...':'Fahrzeug speichern'}</button></div></form></Card>;
}
