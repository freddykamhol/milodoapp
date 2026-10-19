import crypto from 'node:crypto';
import {and,asc,eq} from 'drizzle-orm';
import {db,sqlite} from './db';
import {appointments,appointmentApplications,appointmentRequirements,courseParticipants,courseMaterials,customers} from '@/db/schema';
import {courseType,type CourseData} from './course-types';
export class CourseError extends Error{constructor(message:string,public status=400){super(message);}}
export type CourseViewer={id:number;role:string;qualAusb?:string|null};
export const courseManager=(viewer:CourseViewer)=>viewer.role==='ADMIN'||viewer.role==='VERWALTUNG';
export async function courseAccess(id:number,viewer:CourseViewer){
 if(!Number.isSafeInteger(id)||id<1)throw new CourseError('Ungültiger Kurs.');
 const row=await db.query.appointments.findFirst({where:and(eq(appointments.id,id),eq(appointments.bereich,'ERSTE_HILFE'))});if(!row)throw new CourseError('Kurs nicht gefunden.',404);
 const customer=await db.query.customers.findFirst({where:eq(customers.id,row.customerId)});
 const manager=courseManager(viewer),isInstructor=viewer.role==='PERSONAL'&&viewer.qualAusb==='AUSBILDER',assigned=isInstructor&&row.approved&&Boolean(await db.query.appointmentApplications.findFirst({where:and(eq(appointmentApplications.appointmentId,id),eq(appointmentApplications.userId,viewer.id),eq(appointmentApplications.status,'CONFIRMED'))})),canStaff=manager||(isInstructor&&row.approved&&row.state==='OPEN');
 if(!canStaff&&!(viewer.role==='KUNDE'&&customer?.accountUserId===viewer.id))throw new CourseError('Keine Berechtigung.',403);
 return {row,customer,canManage:manager,canOperate:manager||assigned,canStaff};
}
export async function loadCourse(id:number,viewer:CourseViewer):Promise<CourseData>{
 const {row,customer,canManage,canOperate,canStaff}=await courseAccess(id,viewer);
 const participants=canOperate?await db.select({id:courseParticipants.id,firstName:courseParticipants.firstName,lastName:courseParticipants.lastName,dateOfBirth:courseParticipants.dateOfBirth,present:courseParticipants.present,source:courseParticipants.source}).from(courseParticipants).where(eq(courseParticipants.appointmentId,id)).orderBy(asc(courseParticipants.lastName),asc(courseParticipants.firstName),asc(courseParticipants.id)):[];
 const materials=canOperate?await db.select({id:courseMaterials.id,itemId:courseMaterials.itemId,name:courseMaterials.name,inventoryNumber:courseMaterials.inventoryNumber,quantity:courseMaterials.quantity}).from(courseMaterials).where(eq(courseMaterials.appointmentId,id)):[];
 const requirements=canOperate?await db.select({kind:appointmentRequirements.kind,value:appointmentRequirements.value,minCount:appointmentRequirements.minCount}).from(appointmentRequirements).where(eq(appointmentRequirements.appointmentId,id)):[];
 let locationDetails={name:row.einsatzort,street:'',houseNumber:'',plz:'',city:''},courseLocationType:'OWN'|'EXTERNAL'='OWN';
 try { const details=JSON.parse(row.detailsJson||'{}') as {location?:typeof locationDetails;courseLocationType?:'OWN'|'EXTERNAL'}; if(details.location) locationDetails={...locationDetails,...details.location}; courseLocationType=details.courseLocationType??(locationDetails.name==='Eigene Ausbildungsräume'?'OWN':'EXTERNAL'); } catch {}
 return {id:row.id,title:row.title,customerId:row.customerId,courseType:row.courseType,participantLimit:row.courseParticipantLimit,startAt:row.startAt.toISOString(),endAt:row.endAt?.toISOString()??null,location:row.einsatzort,locationDetails,courseLocationType,customerName:customer?.name??'',notes:row.notes,requirements,state:row.state,approved:row.approved,staffingStatus:row.staffingStatus,registrationEnabled:Boolean(row.courseRegistrationHash),registrationExpiresAt:row.courseRegistrationExpiresAt?.toISOString()??null,canManage,canOperate,canStaff,participants,materials};
}
export function validateCourse(type:unknown,limit:unknown){const info=courseType(type);if(!info)throw new CourseError('Bitte eine gültige Kursart auswählen.');if(!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>500)throw new CourseError('Die Teilnehmerzahl muss zwischen 1 und 500 liegen.');return {courseType:info.id,courseParticipantLimit:Number(limit)};}
export function courseTimestamp(value:unknown){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new CourseError('Ungültiger Kursbeginn.');return new Date(value);}
export function participantValues(input:unknown){
 if(!input||typeof input!=='object')throw new CourseError('Ungültige Teilnehmerdaten.');const body=input as Record<string,unknown>;
 const name=(value:unknown,label:string)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>100||/[\u0000-\u001f]/.test(value))throw new CourseError(`${label} ist erforderlich (maximal 100 Zeichen).`);return value.trim().replace(/\s+/g,' ');};
 const firstName=name(body.firstName,'Vorname'),lastName=name(body.lastName,'Nachname'),dateOfBirth=body.dateOfBirth;
 if(typeof dateOfBirth!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))throw new CourseError('Bitte das Geburtsdatum angeben.');const date=new Date(dateOfBirth+'T00:00:00Z');if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==dateOfBirth||date>new Date()||dateOfBirth<'1900-01-01')throw new CourseError('Ungültiges Geburtsdatum.');
 return {firstName,lastName,dateOfBirth,identityKey:[firstName,lastName,dateOfBirth].map(value=>value.normalize('NFKC').toLocaleLowerCase('de')).join('\u001f')};
}
export const tokenHash=(token:string)=>crypto.createHash('sha256').update(token).digest('hex');
export function publicCourse(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))throw new CourseError('Dieser Erfassungslink ist ungültig oder abgelaufen.',404);
 const hash=tokenHash(token),now=Date.now();
 const query='select id,title,course_type,course_participant_limit,start_at,end_at,einsatzort from appointments where %s and bereich=? and state=? and approved=1';
 const row=sqlite.prepare(query.replace('%s','course_registration_hash=? and course_registration_expires_at>?')).get(hash,now,'ERSTE_HILFE','OPEN') as {id:number;title:string;course_type:string;course_participant_limit:number;start_at:number;end_at:number;einsatzort:string}|undefined
   ?? sqlite.prepare('select a.id,a.title,a.course_type,a.course_participant_limit,a.start_at,a.end_at,a.einsatzort from course_registration_links l inner join appointments a on a.id=l.appointment_id where l.token_hash=? and l.revoked_at is null and l.expires_at>? and a.bereich=? and a.state=? and a.approved=1').get(hash,now,'ERSTE_HILFE','OPEN') as {id:number;title:string;course_type:string;course_participant_limit:number;start_at:number;end_at:number;einsatzort:string}|undefined;
 if(!row||!courseType(row.course_type))throw new CourseError('Dieser Erfassungslink ist ungültig oder abgelaufen.',404);return row;
}
export function addParticipants(id:number,entries:unknown[],actor:number|null,token?:string){
 if(!Array.isArray(entries)||entries.length<1||entries.length>20)throw new CourseError('Bitte 1 bis 20 Teilnehmer pro Vorgang eintragen.');const values=entries.map(participantValues);
 return sqlite.transaction(()=>{
  const row=token?publicCourse(token):sqlite.prepare('select id,course_type,course_participant_limit,state from appointments where id=? and bereich=?').get(id,'ERSTE_HILFE') as {id:number;course_type:string;course_participant_limit:number;state:string}|undefined;
  if(!row||row.id!==id||!courseType(row.course_type))throw new CourseError('Bitte zuerst die Kursdaten vervollständigen.',409);if('state' in row&&row.state==='CANCELLED')throw new CourseError('Der Kurs wurde abgesagt.',409);
  const existing=sqlite.prepare('select identity_key from course_participants where appointment_id=?').all(id) as {identity_key:string}[],known=new Set(existing.map(p=>p.identity_key)),fresh=values.filter(value=>{if(known.has(value.identityKey))return false;known.add(value.identityKey);return true;});
  if(existing.length+fresh.length>row.course_participant_limit)throw new CourseError('Die geplante Teilnehmerzahl ist erreicht. Bitte den Veranstalter kontaktieren.',409);
  const insert=sqlite.prepare('insert into course_participants(appointment_id,first_name,last_name,date_of_birth,identity_key,source,created_at,updated_at,updated_by_id) values(?,?,?,?,?,?,?,?,?)'),now=Date.now();
  for(const value of fresh)insert.run(id,value.firstName,value.lastName,value.dateOfBirth,value.identityKey,token?'EXTERNAL':'INTERNAL',now,now,actor);
  return {added:fresh.length,duplicates:values.length-fresh.length};
 }).immediate();
}
