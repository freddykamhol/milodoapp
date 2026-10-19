"use client";
import { notify } from "@/app/_components/feedback";
import { AppSelect } from "@/app/_components/select";
import * as React from "react";
import { Card } from "../../_components/ui";

const input="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm";
type Vehicle={id:number;licensePlate:string;type:string};
export function InventoryForm(){
 const [category,setCategory]=React.useState("MEDICAL_DEVICE"),[form,setForm]=React.useState<Record<string,string>>({name:"",quantity:"1",minimumQuantity:"0",unit:"Stück",location:"",manufacturer:"",model:"",serialNumber:"",lotNumber:"",expiryAt:"",inspectionIntervalDays:"365",lastInspectionAt:"",nextInspectionAt:"",medicalDeviceClass:"",udi:"",commissionedAt:"",oxygenCapacityLiters:"",oxygenPressureBar:"",oxygenContentPercent:"",notes:""});
 const [saving,setSaving]=React.useState(false);const overrideRef=React.useRef(false);
 const [inventoryNumber,setInventoryNumber]=React.useState(""),[overrideNumber,setOverrideNumber]=React.useState(false),[vehicles,setVehicles]=React.useState<Vehicle[]>([]),[selectedVehicle,setSelectedVehicle]=React.useState(""),[materialType,setMaterialType]=React.useState("STANDARD");
 React.useEffect(()=>{const controller=new AbortController();fetch(`/api/inventory?nextNumber=${category}`,{signal:controller.signal}).then(r=>r.json()).then(d=>{if(!overrideRef.current)setInventoryNumber(d.inventoryNumber??"");}).catch(error=>{if(error.name!=="AbortError")notify("Inventarnummer konnte nicht geladen werden.");});return()=>controller.abort();},[category]);
 React.useEffect(()=>{fetch("/api/vehicles?view=vehicles").then(r=>r.json()).then(d=>setVehicles(d.vehicles??[]));},[]);
 const set=(key:string,value:string)=>setForm(prev=>({...prev,[key]:value}));
 const categories=["MEDICAL_DEVICE","CONSUMABLE","BAG","OTHER"];
 const labels:Record<string,string>={MEDICAL_DEVICE:"Medizinprodukt",CONSUMABLE:"Verbrauchsmaterial",BAG:"Rucksack / Tasche",OTHER:"Sonstiges"};
 const shared:[string,string,string?][]=[["name","Bezeichnung"]];
 const common:[string,string,string?][]={
  MEDICAL_DEVICE:[["manufacturer","Hersteller"],["model","Modell"],["serialNumber","Seriennummer"],["medicalDeviceClass","Medizinprodukteklasse"],["udi","UDI"],["commissionedAt","Inbetriebnahme","date"],["inspectionIntervalDays","Prüfintervall (Tage)","number"],["lastInspectionAt","Letzte Prüfung","date"],["nextInspectionAt","Nächste Prüfung","date"]],
  CONSUMABLE:[["quantity","Bestand","number"],["minimumQuantity","Mindestbestand","number"],["unit","Einheit"],["lotNumber","Chargennummer"],["expiryAt","Verfallsdatum","date"]],
  BAG:[["manufacturer","Hersteller"],["model","Modell"]],
  OTHER:[["quantity","Bestand","number"],["minimumQuantity","Mindestbestand","number"],["unit","Einheit"]],
 }[category] as [string,string,string?][];
 const oxygenFields:[string,string,string?][]=[["manufacturer","Hersteller"],["model","Flaschentyp / Modell"],["serialNumber","Flaschentyp / interne Kennzeichnung"],["oxygenCapacityLiters","Flascheninhalt (Liter)","number"],["oxygenPressureBar","Prüfdruck (bar)","number"],["oxygenContentPercent","Sauerstoffgehalt (%)","number"],["inspectionIntervalDays","Prüfintervall (Tage)","number"],["lastInspectionAt","Letzte Prüfung","date"],["nextInspectionAt","Nächste Prüfung","date"]];
 const render=(entry:[string,string,string?])=>{const [key,label,type]=entry;return <label className="text-xs font-semibold" key={key}>{label}<input className={`${input} mt-1`} type={type??"text"} min={type==="number"?"0":undefined} required={key==="name"||(category==="CONSUMABLE"&&materialType==="OXYGEN"&&key==="oxygenCapacityLiters")} value={form[key]??""} onChange={e=>set(key,e.target.value)}/></label>;};
 return <Card title="Artikel anlegen"><form className="grid gap-4 md:grid-cols-2" onSubmit={async e=>{e.preventDefault();if(saving)return;setSaving(true);try{const v=vehicles.find(x=>String(x.id)===selectedVehicle);const body:Record<string,unknown>={...form,category,inventoryNumber,autoInventoryNumber:!overrideNumber,location:v?`Fahrzeug: ${v.licensePlate}`:form.location,quantity:Number(form.quantity||0),minimumQuantity:Number(form.minimumQuantity||0),inspectionIntervalDays:Number(form.inspectionIntervalDays||0),materialType};for(const k of ["oxygenCapacityLiters","oxygenPressureBar","oxygenContentPercent"])body[k]=form[k]?Number(form[k]):null;const response=await fetch("/api/inventory",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok){notify(result.error);return;}location.href=`/inventory/items/${result.id}`;}catch{notify("Artikel konnte nicht gespeichert werden. Bitte erneut versuchen.");}finally{setSaving(false);}}}>
  <label className="text-xs font-semibold">Kategorie<AppSelect className={`${input} mt-1`} value={category} onChange={e=>{setCategory(e.target.value);setSelectedVehicle("");setOverrideNumber(false);overrideRef.current=false;}}>{categories.map(c=><option key={c} value={c}>{labels[c]}</option>)}</AppSelect></label>
  <label className="text-xs font-semibold">Inventarnummer<input className={`${input} mt-1`} value={inventoryNumber} onChange={e=>{setOverrideNumber(true);overrideRef.current=true;setInventoryNumber(e.target.value);}}/><span className="mt-1 block font-normal text-[color:var(--muted)]">Kategoriebezogen vorgeschlagen; überschreibbar.</span></label>
  {shared.map(render)}
  {category==="CONSUMABLE"?<label className="text-xs font-semibold">Art<AppSelect className={`${input} mt-1`} value={materialType} onChange={e=>setMaterialType(e.target.value)}><option value="STANDARD">Verbrauchsmaterial</option><option value="OXYGEN">Sauerstoffflasche (Bestandsartikel)</option></AppSelect></label>:null}
  {category==="CONSUMABLE"&&materialType==="OXYGEN"?[...common,...oxygenFields.filter(([key])=>key!=="serialNumber")].map(render):common.map(render)}
  {category==="MEDICAL_DEVICE"||category==="BAG"?<><label className="text-xs font-semibold">Standort: Fahrzeug<AppSelect className={`${input} mt-1`} value={selectedVehicle} onChange={e=>setSelectedVehicle(e.target.value)}><option value="">Kein Fahrzeug ausgewählt</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.licensePlate} · {v.type}</option>)}</AppSelect></label><label className="text-xs font-semibold">Oder Standort als Freitext<input className={`${input} mt-1`} value={form.location} onChange={e=>{setSelectedVehicle("");set("location",e.target.value);}} placeholder="z. B. Lager Nord"/></label></>:<label className="text-xs font-semibold">Standort<input className={`${input} mt-1`} value={form.location} onChange={e=>set("location",e.target.value)}/></label>}
  <label className="text-xs font-semibold md:col-span-2">Notizen<textarea className={`${input} mt-1 h-24 py-3`} value={form.notes} onChange={e=>set("notes",e.target.value)}/></label>
  <button disabled={saving} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white md:col-span-2">{saving?"Wird gespeichert …":"Artikel speichern"}</button>
 </form></Card>;
}
