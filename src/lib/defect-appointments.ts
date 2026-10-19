import {and,asc,eq,gte,isNull,lt,or,type SQL} from "drizzle-orm";
import {db} from "./db";
import {defectAppointments,inventoryDefects,inventoryItems,vehicleDefects,vehicles,vehicleServiceCompanies} from "@/db/schema";
import type {DefectAppointment,DefectDomain} from "./defect-appointment-types";

export async function loadDefectAppointments(filter:{domain?:DefectDomain;defectId?:number;assetId?:number;from?:Date;to?:Date}):Promise<DefectAppointment[]>{
 const where:SQL[]=[];
 if(filter.domain==='vehicle')where.push(isNull(defectAppointments.inventoryDefectId));
 if(filter.domain==='inventory')where.push(isNull(defectAppointments.vehicleDefectId));
 if(filter.defectId!==undefined)where.push(eq(filter.domain==='vehicle'?defectAppointments.vehicleDefectId:defectAppointments.inventoryDefectId,filter.defectId));
 if(filter.assetId!==undefined)where.push(eq(filter.domain==='vehicle'?vehicleDefects.vehicleId:inventoryDefects.itemId,filter.assetId));
 if(filter.to)where.push(lt(defectAppointments.startAt,filter.to));
 if(filter.from)where.push(or(gte(defectAppointments.endAt,filter.from),and(isNull(defectAppointments.endAt),gte(defectAppointments.startAt,filter.from)))!);
 const rows=await db.select({appointment:defectAppointments,vehicleDefectTitle:vehicleDefects.title,plate:vehicles.licensePlate,itemDefectTitle:inventoryDefects.title,itemName:inventoryItems.name,inventoryNumber:inventoryItems.inventoryNumber})
  .from(defectAppointments).leftJoin(vehicleDefects,eq(defectAppointments.vehicleDefectId,vehicleDefects.id)).leftJoin(vehicles,eq(vehicleDefects.vehicleId,vehicles.id))
  .leftJoin(inventoryDefects,eq(defectAppointments.inventoryDefectId,inventoryDefects.id)).leftJoin(inventoryItems,eq(inventoryDefects.itemId,inventoryItems.id)).where(and(...where)).orderBy(asc(defectAppointments.startAt),asc(defectAppointments.id));
 return rows.map(({appointment:a,...row})=>{const domain:DefectDomain=a.vehicleDefectId!==null?'vehicle':'inventory',defectId=(a.vehicleDefectId??a.inventoryDefectId)!;return {id:a.id,domain,defectId,defectTitle:(domain==='vehicle'?row.vehicleDefectTitle:row.itemDefectTitle)??'',defectHref:`/${domain==='vehicle'?'vehicles':'inventory'}/defects/${defectId}`,assetLabel:domain==='vehicle'?row.plate??'Fahrzeug':`${row.itemName??'Medizinprodukt'}${row.inventoryNumber?' · '+row.inventoryNumber:''}`,title:a.title,description:a.description,location:a.location,companyId:a.companyId,companyName:a.companyName,startAt:a.startAt.toISOString(),endAt:a.endAt?.toISOString()??null};});
}
export async function loadDefectAppointmentCompanies(){return db.select({id:vehicleServiceCompanies.id,name:vehicleServiceCompanies.name,address:vehicleServiceCompanies.address}).from(vehicleServiceCompanies).orderBy(asc(vehicleServiceCompanies.name));}
export class DefectAppointmentError extends Error{constructor(message:string,public status=400){super(message);}}
function text(value:unknown,max:number,label:string,required=false){if(value!==undefined&&typeof value!=='string')throw new DefectAppointmentError(`${label} ist ungültig.`);const result=String(value??'').trim();if(result.length>max||(required&&!result))throw new DefectAppointmentError(`${label} bitte ausfüllen (maximal ${max} Zeichen).`);return result;}
function timestamp(value:unknown,label:string){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new DefectAppointmentError(`${label} ist ungültig.`);
 const day=value.slice(0,10),calendarDay=new Date(day+'T00:00:00Z');
 if(!Number.isFinite(+calendarDay)||calendarDay.toISOString().slice(0,10)!==day)throw new DefectAppointmentError(`${label} enthält ein ungültiges Datum.`);
 return new Date(value);
}
export async function validateDefectAppointment(input:unknown){
 if(!input||typeof input!=='object')throw new DefectAppointmentError('Ungültiger Termin.');
 const body=input as Record<string,unknown>;
 const title=text(body.title,200,'Titel',true),description=text(body.description,5000,'Beschreibung'),startAt=timestamp(body.startAt,'Beginn'),endAt=body.endAt==null||body.endAt===''?null:timestamp(body.endAt,'Ende');
 if(endAt&&endAt<=startAt)throw new DefectAppointmentError('Das Ende muss nach dem Beginn liegen.');
 const companyId=body.companyId==null||body.companyId===''?null:body.companyId;
 if(companyId!==null&&(!Number.isSafeInteger(companyId)||Number(companyId)<1))throw new DefectAppointmentError('Ungültige Firma.');
 const company=companyId===null?null:await db.query.vehicleServiceCompanies.findFirst({where:(t,{eq})=>eq(t.id,Number(companyId))});
 if(companyId!==null&&!company)throw new DefectAppointmentError('Die ausgewählte Firma existiert nicht mehr.');
 const location=text(body.location??company?.address,500,'Ort / Adresse');
 return {title,description,startAt,endAt,companyId:company?.id??null,companyName:company?.name??'',location};
}
export async function requireDefect(domain:unknown,id:unknown){
 if((domain!=='vehicle'&&domain!=='inventory')||!Number.isSafeInteger(id)||Number(id)<1)throw new DefectAppointmentError('Ungültiger Mangel.');
 if(domain==='vehicle'){if(!await db.query.vehicleDefects.findFirst({where:(t,{eq})=>eq(t.id,Number(id)),columns:{id:true}}))throw new DefectAppointmentError('Mangel nicht gefunden.',404);}
 else{const rows=await db.select({id:inventoryDefects.id,category:inventoryItems.category}).from(inventoryDefects).innerJoin(inventoryItems,eq(inventoryDefects.itemId,inventoryItems.id)).where(eq(inventoryDefects.id,Number(id)));if(!rows.length)throw new DefectAppointmentError('Mangel nicht gefunden.',404);if(rows[0].category!=='MEDICAL_DEVICE')throw new DefectAppointmentError('Mangeltermine sind für Medizinprodukte vorgesehen.');}
 return {vehicleDefectId:domain==='vehicle'?Number(id):null,inventoryDefectId:domain==='inventory'?Number(id):null};
}
