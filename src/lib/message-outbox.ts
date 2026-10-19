import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { canSendMessages, messageRoles, messageQualifications, messageRecipientEmails, validEmail, type MessageDetail, type MessageSummary, type RecipientSelection, type RecipientUser } from "./message-types";

export class MessageValidationError extends Error {}
export type OutboxFile = { name:string; mimeType:string; content:Buffer };
type Sender = (mail:{to:string;subject:string;message:string;attachments:{filename:string;content:Buffer;contentType:string}[]})=>Promise<{ok:boolean;error?:string}>;
export function parseRecipients(input:unknown,users:RecipientUser[]):{selection:RecipientSelection;emails:string[]} {
 if(!input||typeof input!=="object")throw new MessageValidationError("Bitte Empfänger auswählen.");
 const raw=input as Record<string,unknown>;
 if(!Array.isArray(raw.roles)||!Array.isArray(raw.userIds)||!Array.isArray(raw.emails)||raw.roles.length>4||raw.userIds.length>5000||raw.emails.length>1000)throw new MessageValidationError("Ungültige Empfängerauswahl.");
 const roles=raw.roles;
 const qualifications=raw.qualifications??[];
 if(!Array.isArray(qualifications)||qualifications.length>messageQualifications.length||qualifications.some(qualification=>!messageQualifications.some(item=>item.value===qualification)))throw new MessageValidationError("Ungültige Qualifikation.");
 if(roles.some(role=>!messageRoles.some(item=>item.value===role)))throw new MessageValidationError("Ungültige Rolle.");
 if(raw.userIds.some(id=>!Number.isSafeInteger(id)||!users.some(user=>user.id===id)))throw new MessageValidationError("Ein ausgewählter Benutzer existiert nicht mehr.");
 if(raw.emails.some(email=>typeof email!=="string"||!validEmail(email.trim())))throw new MessageValidationError("Bitte gültige E-Mail-Adressen eingeben.");
 const selection:RecipientSelection={roles:[...new Set(roles)] as RecipientSelection['roles'],qualifications:[...new Set(qualifications)] as NonNullable<RecipientSelection['qualifications']>,userIds:[...new Set(raw.userIds)] as number[],emails:[...new Set((raw.emails as string[]).map(email=>email.trim().toLowerCase()))]};
 const emails=messageRecipientEmails(users,selection);
 if(!emails.length)throw new MessageValidationError("Die Auswahl enthält keine gültige E-Mail-Adresse.");
 if(emails.length>5000)throw new MessageValidationError("Maximal 5.000 Empfänger sind möglich.");
 return {selection,emails};
}

/** Durable queue. Every delivery is atomically claimed, including across processes. */
export function createMessageOutbox(sqlite:Database.Database,send:Sender){
 const summarize=(id:number)=>{
  const rows=sqlite.prepare('select status,count(*) n from message_deliveries where job_id=? group by status').all(id) as {status:string;n:number}[];
  const counts=new Map(rows.map(row=>[row.status,row.n]));
  const current=sqlite.prepare('select status,scheduled_at from message_jobs where id=?').get(id) as {status:string;scheduled_at:number}|undefined;
  if(!current||current.status==='CANCELLED')return;
  const pending=counts.get('PENDING')??0,sending=counts.get('SENDING')??0,sent=counts.get('SENT')??0,failed=counts.get('FAILED')??0,unknown=counts.get('UNKNOWN')??0;
  const status=sending?'SENDING':pending?(current.scheduled_at>Date.now()?'SCHEDULED':'QUEUED'):sent&&!failed&&!unknown?'SENT':sent?'PARTIAL':unknown?'UNKNOWN':'FAILED';
  sqlite.prepare('update message_jobs set status=? where id=?').run(status,id);
 };
 return {
  enqueue(input:{senderId:number;token:string;subject:string;body:string;selection:RecipientSelection;emails:string[];scheduledAt:number;files:OutboxFile[]}){
   return sqlite.transaction(()=>{
    const existing=sqlite.prepare('select id from message_jobs where created_by_id=? and client_token=?').get(input.senderId,input.token) as {id:number}|undefined;
    if(existing)return {id:existing.id,existing:true};
    const status=input.scheduledAt>Date.now()?'SCHEDULED':'QUEUED';
    const job=sqlite.prepare('insert into message_jobs(created_at,created_by_id,client_token,subject,body,selection_json,scheduled_at,status) values(?,?,?,?,?,?,?,?)').run(Date.now(),input.senderId,input.token,input.subject,input.body,JSON.stringify(input.selection),input.scheduledAt,status);
    const id=Number(job.lastInsertRowid),delivery=sqlite.prepare('insert into message_deliveries(job_id,email) values(?,?)');
    for(const email of input.emails)delivery.run(id,email);
    const file=sqlite.prepare('insert into message_attachments(job_id,name,mime_type,size_bytes,content) values(?,?,?,?,?)');
    for(const item of input.files)file.run(id,item.name,item.mimeType,item.content.byteLength,item.content);
    return {id,existing:false};
   }).immediate();
  },
  list(limit=50,id?:number):MessageSummary[]{
   const rows=sqlite.prepare(`select j.id,j.created_at,j.scheduled_at,j.subject,j.status,u.username sender,
    (select count(*) from message_deliveries where job_id=j.id) total,
    (select count(*) from message_deliveries where job_id=j.id and status='SENT') sent,
    (select count(*) from message_deliveries where job_id=j.id and status='FAILED') failed,
    (select count(*) from message_deliveries where job_id=j.id and status='UNKNOWN') unknown,
    (select count(*) from message_attachments where job_id=j.id) attachments
    from message_jobs j join users u on u.id=j.created_by_id ${id===undefined?'':'where j.id=?'} order by j.created_at desc,j.id desc limit ?`).all(...(id===undefined?[limit]:[id,limit])) as {id:number;created_at:number;scheduled_at:number;subject:string;status:string;sender:string;total:number;sent:number;failed:number;unknown:number;attachments:number}[];
   return rows.map(({created_at,scheduled_at,...row})=>({...row,createdAt:new Date(created_at).toISOString(),scheduledAt:new Date(scheduled_at).toISOString()}));
  },
  detail(id:number):MessageDetail|null{
   const job=sqlite.prepare('select body,selection_json from message_jobs where id=?').get(id) as {body:string;selection_json:string}|undefined;
   if(!job)return null;
   // Reuse the projection without loading attachment blobs into page props.
   const summary=this.list(1,id)[0]!;
   const deliveries=sqlite.prepare('select id,email,status,error,sent_at from message_deliveries where job_id=? order by id').all(id) as {id:number;email:string;status:string;error:string|null;sent_at:number|null}[];
   const files=sqlite.prepare('select id,name,mime_type mimeType,size_bytes sizeBytes from message_attachments where job_id=?').all(id) as MessageDetail['files'];
   return {...summary,body:job.body,selection:JSON.parse(job.selection_json),deliveries:deliveries.map(({sent_at,...row})=>({...row,sentAt:sent_at?new Date(sent_at).toISOString():null})),files};
  },
  cancel(id:number){return sqlite.transaction(()=>{
   const sending=sqlite.prepare("select id from message_deliveries where job_id=? and status='SENDING' limit 1").get(id);
   if(sending)throw new MessageValidationError("Die Nachricht wird bereits gesendet und kann gerade nicht abgebrochen werden.");
   const result=sqlite.prepare("update message_jobs set status='CANCELLED' where id=? and status in ('SCHEDULED','QUEUED')").run(id);
   if(!result.changes)throw new MessageValidationError("Diese Nachricht kann nicht mehr abgebrochen werden.");
   sqlite.prepare("update message_deliveries set status='CANCELLED' where job_id=? and status='PENDING'").run(id);
  }).immediate();},
  retry(id:number){return sqlite.transaction(()=>{
   const job=sqlite.prepare('select status from message_jobs where id=?').get(id) as {status:string}|undefined;
   if(!job||!['FAILED','PARTIAL'].includes(job.status))throw new MessageValidationError("Diese Nachricht kann nicht erneut gesendet werden.");
   const result=sqlite.prepare("update message_deliveries set status='PENDING',error=null where job_id=? and status='FAILED'").run(id);
   if(!result.changes)throw new MessageValidationError("Es gibt keine sicher fehlgeschlagenen Zustellungen. Unklare Zustellungen werden zum Schutz vor Doppelversand nicht automatisch wiederholt.");
   sqlite.prepare("update message_jobs set status='QUEUED',scheduled_at=? where id=?").run(Date.now(),id);
  }).immediate();},
  async processDue(maxDeliveries=25){
   // A crash after SMTP acceptance is inherently ambiguous. Never silently resend.
   sqlite.transaction(()=>{
    const stale=sqlite.prepare("select distinct job_id from message_deliveries where status='SENDING' and claimed_at<?").all(Date.now()-300000) as {job_id:number}[];
    sqlite.prepare("update message_deliveries set status='UNKNOWN',error='Versand unterbrochen. Bitte vor erneutem Versand den Mailausgang prüfen.' where status='SENDING' and claimed_at<?").run(Date.now()-300000);
    for(const row of stale)summarize(row.job_id);
   }).immediate();
   let processed=0;
   while(processed<maxDeliveries){
    const claimed=sqlite.transaction(()=>{
     const row=sqlite.prepare(`select d.id,d.job_id,d.email,j.subject,j.body,u.role from message_deliveries d join message_jobs j on j.id=d.job_id join users u on u.id=j.created_by_id where d.status='PENDING' and j.status in ('QUEUED','SCHEDULED','SENDING') and j.scheduled_at<=? order by j.scheduled_at,j.id,d.id limit 1`).get(Date.now()) as {id:number;job_id:number;email:string;subject:string;body:string;role:string}|undefined;
     if(!row)return null;
     if(!canSendMessages(row.role)){
      sqlite.prepare("update message_deliveries set status='FAILED',error='Absender besitzt keine Versandberechtigung mehr.' where job_id=? and status='PENDING'").run(row.job_id);summarize(row.job_id);return {skipped:true} as const;
     }
     const token=crypto.randomUUID();
     sqlite.prepare("update message_deliveries set status='SENDING',claimed_at=?,claim_token=? where id=? and status='PENDING'").run(Date.now(),token,row.id);
     sqlite.prepare("update message_jobs set status='SENDING' where id=?").run(row.job_id);
     return {skipped:false,row,token} as const;
    }).immediate();
    if(!claimed)break;
    processed++;
    if(claimed.skipped)continue;
    const {row,token}=claimed;
    let status='FAILED',error:string|null=null;
    try{
     const files=sqlite.prepare('select name,mime_type,content from message_attachments where job_id=?').all(row.job_id) as {name:string;mime_type:string;content:Buffer}[];
     const result=await send({to:row.email,subject:row.subject,message:row.body,attachments:files.map(file=>({filename:file.name,content:file.content,contentType:file.mime_type}))});
     status=result.ok?'SENT':'FAILED';error=result.ok?null:'Mailserver nicht verfügbar oder Zustellung abgelehnt. Bitte SMTP-Einstellungen und Empfänger prüfen.';
    }catch(cause){
     const failure=cause as {code?:string;command?:string;responseCode?:number}|null;
     const rejected=failure?.code==='EAUTH'||['CONN','EHLO','HELO','AUTH','STARTTLS'].includes(failure?.command??'')||(typeof failure?.responseCode==='number'&&failure.responseCode>=400&&failure.responseCode<600);
     status=rejected?'FAILED':'UNKNOWN';error=rejected?'Der Mailserver hat die Verbindung, Anmeldung oder Zustellung abgelehnt. Bitte SMTP-Einstellungen prüfen.':'Die Zustellung konnte nicht sicher bestätigt werden. Bitte den Mailausgang prüfen, bevor erneut gesendet wird.';
    }
    sqlite.transaction(()=>{
     sqlite.prepare("update message_deliveries set status=?,sent_at=?,error=? where id=? and status='SENDING' and claim_token=?").run(status,status==='SENT'?Date.now():null,error,row.id,token);summarize(row.job_id);
    }).immediate();
   }
   return processed;
  },
 };
}
