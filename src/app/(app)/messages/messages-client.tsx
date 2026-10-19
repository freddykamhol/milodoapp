"use client";
import * as React from "react";
import Link from "next/link";
import {Card,Badge} from "../_components/ui";
import {RecipientSelector} from "@/app/_components/recipient-selector";
import {FileUpload} from "@/app/_components/file-upload";
import {confirmAction,notify} from "@/app/_components/feedback";
import {dateFormatter} from "@/lib/date-format";
import {messageStatusLabels,messageRecipientEmails,type MessageSummary,type RecipientSelection,type RecipientUser} from "@/lib/message-types";
import {usePropState} from "@/app/_components/state";

const empty:RecipientSelection={roles:[],qualifications:[],userIds:[],emails:[]};
const format=(value:string)=>dateFormatter({dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function MessagesClient({users,initialItems}:{users:RecipientUser[];initialItems:MessageSummary[]}){
 const [recipients,setRecipients]=React.useState<RecipientSelection>(empty);
 const [subject,setSubject]=React.useState(''),[body,setBody]=React.useState(''),[files,setFiles]=React.useState<File[]>([]);
 const [mode,setMode]=React.useState('now'),[scheduledAt,setScheduledAt]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[token,setToken]=React.useState('');
 const [items,setItems]=usePropState(initialItems),submitting=React.useRef(false);
 const emails=React.useMemo(()=>messageRecipientEmails(users,recipients),[users,recipients]);
 const pending=items.some(item=>['SCHEDULED','QUEUED','SENDING'].includes(item.status));
 const refresh=React.useCallback(async()=>{try{const response=await fetch('/api/messages',{cache:'no-store'});if(response.ok)setItems((await response.json()).items);}catch{/* Keep the last confirmed status when offline. */}},[setItems]);
 React.useEffect(()=>{if(!pending)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},5000);return()=>clearInterval(timer);},[pending,refresh]);
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy||submitting.current)return;setError('');
  if(!emails.length){setError('Bitte mindestens einen Empfänger mit gültiger E-Mail-Adresse auswählen.');return;}
  const date=mode==='plan'?new Date(scheduledAt):null;
  if(date&&(!Number.isFinite(+date)||+date<Date.now()+10000)){setError('Bitte einen zukünftigen Versandtermin wählen.');return;}
  if(files.length>10||files.some(file=>file.size>10*1024*1024)||files.reduce((sum,file)=>sum+file.size,0)>20*1024*1024){setError('Maximal 10 Anhänge, 10 MB je Datei und 20 MB insgesamt.');return;}
  submitting.current=true;
  if(!await confirmAction(mode==='plan'?`Nachricht an ${emails.length} Empfänger für ${format(date!.toISOString())} planen?`:`Nachricht jetzt an ${emails.length} Empfänger senden?`)){submitting.current=false;return;}
  setBusy(true);
  try{
   const key=token||Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');setToken(key);
   const form=new FormData();form.set('token',key);form.set('subject',subject);form.set('body',body);form.set('recipients',JSON.stringify(recipients));
   if(date)form.set('scheduledAt',date.toISOString());for(const file of files)form.append('files',file);
   const response=await fetch('/api/messages',{method:'POST',body:form}),result=await response.json();if(!response.ok)throw new Error(result.error||'Nachricht konnte nicht gespeichert werden.');
   setSubject('');setBody('');setFiles([]);setRecipients(empty);setToken('');setScheduledAt('');await refresh();notify(mode==='plan'?'Nachricht wurde geplant.':'Nachricht wurde zum Versand vorgemerkt.');
  }catch(error){setError(error instanceof Error?error.message:'Nachricht konnte nicht gespeichert werden.');}
  finally{setBusy(false);submitting.current=false;}
 }
 return <>
  <Card title="Empfänger auswählen" description="Rollen, Qualifikationen, Benutzer und zusätzliche Adressen kombinieren." actions={<Badge tone={emails.length?'accent':'muted'}>{emails.length} Empfänger</Badge>}>
   <RecipientSelector users={users} value={recipients} allowQualifications disabled={busy} onChange={value=>{setRecipients(value);setToken('');}}/>
   <div className="mt-4 flex flex-col justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs text-[color:var(--muted)] sm:flex-row" aria-live="polite">
    <p>{emails.length} eindeutige E-Mail-Empfänger · Mehrfachauswahl wird zusammengeführt.</p><p>Benutzer ohne gültige Mailadresse werden übersprungen.</p>
   </div>
  </Card>
  <form onSubmit={submit}>
   <fieldset disabled={busy} className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
    <Card title="Nachricht verfassen" description="Betreff, Inhalt und optionale Anhänge.">
     <div className="space-y-5">
      <label className="block text-xs font-semibold">Betreff<input className="ui-input mt-2 text-sm" placeholder="Worum geht es in deiner Nachricht?" required maxLength={200} value={subject} onChange={event=>{setSubject(event.target.value);setToken('');}}/></label>
      <label className="block text-xs font-semibold">Inhalt<textarea className="ui-input mt-2 min-h-64 resize-y text-sm leading-6" placeholder="Nachricht eingeben …" required maxLength={100000} value={body} onChange={event=>{setBody(event.target.value);setToken('');}}/></label>
      <div className="border-t border-[var(--border)] pt-5"><FileUpload files={files} onChange={value=>{setFiles(value);setToken('');}} hint="Maximal 10 Dateien, 10 MB je Datei und 20 MB insgesamt."/></div>
     </div>
    </Card>
    <Card title="Versand" description="Jetzt versenden oder einen Zeitpunkt festlegen.">
     <div className="space-y-4">
      <div className="space-y-2">{[['now','Jetzt senden','Nach Bestätigung zum Versand vormerken.'],['plan','Versand planen','Automatisch zum gewählten Zeitpunkt.']].map(([value,label,description])=><label key={value} className="recipient-option" data-selected={mode===value}>
       <input type="radio" name="send-mode" value={value} checked={mode===value} onChange={()=>{setMode(value);setToken('');}}/><span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-[color:var(--muted)]">{description}</span></span>
      </label>)}</div>
      {mode==='plan'?<label className="block text-xs font-semibold">Versand am<input className="ui-input mt-2 text-sm" type="datetime-local" required value={scheduledAt} onChange={event=>{setScheduledAt(event.target.value);setToken('');}}/><span className="mt-2 block text-xs font-normal leading-5 text-[color:var(--muted)]">Uhrzeit in deiner lokalen Zeitzone. Die Empfänger werden bei der Planung gespeichert.</span></label>:null}
      <div className="rounded-xl bg-[var(--surface-2)] p-3 text-xs leading-5 text-[color:var(--muted)]"><p className="font-semibold text-[color:var(--foreground)]">Einzelversand an {emails.length} Empfänger</p><p className="mt-1">Keine fremden E-Mail-Adressen werden offengelegt.</p>{mode==='plan'?<p className="mt-2">Der interne Versand benötigt eine laufende Anwendung. Nach einem Ausfall wird nachgeholt.</p>:null}</div>
      {error?<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>:null}
      <button className="ui-button-primary w-full" type="submit" disabled={busy}>{busy?'Wird gespeichert …':mode==='plan'?'Nachricht planen':'Nachricht senden'}</button>
     </div>
    </Card>
   </fieldset>
  </form>
  <Card title="Versandübersicht" description="Die letzten 50 Nachrichten. Details zeigen den Status je Empfänger." actions={<button className="ui-button-secondary" type="button" onClick={()=>void refresh()}>Aktualisieren</button>}>
   <div className="divide-y divide-[var(--border)]">{items.map(item=><Link key={item.id} href={`/messages/${item.id}`} className="flex min-w-0 flex-col justify-between gap-3 rounded-xl p-3 transition hover:bg-[var(--surface-2)] sm:flex-row sm:items-center">
    <div className="min-w-0"><p className="break-words text-sm font-semibold">{item.subject}</p><p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{format(item.scheduledAt)} · {item.sender} · {item.sent}/{item.total} versendet · {item.attachments} Anhänge</p></div><Badge tone={item.status==='SENT'?'success':['FAILED','UNKNOWN','PARTIAL'].includes(item.status)?'warning':'muted'}>{messageStatusLabels[item.status]??item.status}</Badge>
   </Link>)}{!items.length?<div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center"><p className="text-sm font-semibold">Noch keine Nachrichten</p><p className="mt-1 text-xs text-[color:var(--muted)]">Gesendete und geplante Nachrichten erscheinen hier.</p></div>:null}</div>
  </Card>
 </>;
}
