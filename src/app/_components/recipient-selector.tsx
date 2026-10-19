"use client";
import * as React from "react";
import {deselectMessageUser,hasMessageQualification,isMessageRecipient,messageQualifications,messageRoles,validEmail,type RecipientSelection,type RecipientUser} from "@/lib/message-types";
import {Pagination,usePagedItems} from "@/app/(app)/_components/pagination";

type Props={value:RecipientSelection;users:RecipientUser[];onChange:(value:RecipientSelection)=>void;disabled?:boolean;allowQualifications?:boolean;emailExtra?:(email:string)=>React.ReactNode};
export function RecipientSelector({value,users,onChange,disabled=false,allowQualifications=false,emailExtra}:Props){
 const [tab,setTab]=React.useState('ROLE'),[draft,setDraft]=React.useState(''),[search,setSearch]=React.useState(''),[error,setError]=React.useState('');
 const id=React.useId(),tabs: [string,string][]=[['ROLE','Rollen'],...(allowQualifications?[['QUALIFICATION','Qualifikation'] as [string,string]]:[]),['USER','Benutzer'],['EMAIL','Adressen']];
 const filtered=React.useMemo(()=>users.filter(user=>`${user.username} ${user.email??''} ${user.qualRD??''} ${user.qualAusb??''}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))),[users,search]);
 const paged=usePagedItems(filtered,search);
 function addEmail(){const email=draft.trim().toLowerCase();if(!validEmail(email)){setError('Bitte eine gültige E-Mail-Adresse eingeben.');return;}onChange({...value,emails:[...new Set([...value.emails,email])]});setDraft('');setError('');}
 function tabKey(event:React.KeyboardEvent<HTMLButtonElement>,index:number){
  let next:number|undefined;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;
  if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=tabs.length-1;
  if(next===undefined)return;
  event.preventDefault();setTab(tabs[next][0]);document.getElementById(`${id}-tab-${tabs[next][0]}`)?.focus();
 }
 return <div className="min-w-0 space-y-4">
  <div className={`recipient-tabs ${allowQualifications?'recipient-tabs-four':''}`} role="tablist" aria-label="Empfängerauswahl">
   {tabs.map(([key,label],index)=><button key={key} id={`${id}-tab-${key}`} type="button" role="tab" aria-selected={tab===key} aria-controls={`${id}-panel`} tabIndex={tab===key?0:-1} onClick={()=>setTab(key)} onKeyDown={event=>tabKey(event,index)} className="recipient-tab">{label}</button>)}
  </div>
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`}>
   {tab==='ROLE'?<div className="grid gap-2 sm:grid-cols-2">{messageRoles.map(role=>{
    const checked=value.roles.includes(role.value),count=users.filter(user=>user.role===role.value&&user.email&&validEmail(user.email.trim())).length;
    return <label key={role.value} className="recipient-option" data-selected={checked}>
     <input type="checkbox" aria-label={role.label} disabled={disabled} checked={checked} onChange={event=>onChange({...value,roles:event.target.checked?[...value.roles,role.value]:value.roles.filter(item=>item!==role.value),userIds:event.target.checked?value.userIds:value.userIds.filter(userId=>users.find(user=>user.id===userId)?.role!==role.value)})}/>
     <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{role.label}</span><span className="mt-1 block text-xs text-[color:var(--muted)]">{count} mit E-Mail-Adresse</span></span>
    </label>;
   })}</div>:null}
   {tab==='QUALIFICATION'&&allowQualifications?<div className="space-y-3"><p className="text-xs leading-5 text-[color:var(--muted)]">Auswahl anhand der im Profil hinterlegten Qualifikation. Mehrere Qualifikationen lassen sich kombinieren.</p><div className="grid gap-2 sm:grid-cols-2">{messageQualifications.map(qualification=>{
    const checked=(value.qualifications??[]).includes(qualification.value),count=users.filter(user=>hasMessageQualification(user,qualification.value)&&user.email&&validEmail(user.email.trim())).length;
    return <label key={qualification.value} className="recipient-option" data-selected={checked}>
     <input type="checkbox" aria-label={`${qualification.label} (${qualification.value})`} disabled={disabled} checked={checked} onChange={event=>onChange({...value,qualifications:event.target.checked?[...(value.qualifications??[]),qualification.value]:(value.qualifications??[]).filter(item=>item!==qualification.value)})}/>
     <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{qualification.label}</span><span className="mt-1 block text-xs text-[color:var(--muted)]">{qualification.description} · {count} mit E-Mail-Adresse</span></span>
    </label>;
   })}</div></div>:null}
   {tab==='USER'?<div className="space-y-3"><input type="search" className="ui-input text-sm" aria-label="Empfänger suchen" placeholder="Benutzer, E-Mail oder Qualifikation suchen" value={search} onChange={event=>setSearch(event.target.value)}/><div className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">{paged.items.map(user=>{
    const checked=isMessageRecipient(user,value);
    return <label key={user.id} className="recipient-option" data-selected={checked}><input type="checkbox" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked?{...value,userIds:[...new Set([...value.userIds,user.id])]}:deselectMessageUser(user,value,users))}/><span className="min-w-0"><span className="block break-words text-sm font-semibold">{user.username}</span><span className="mt-1 block break-all text-xs text-[color:var(--muted)]">{user.email||'Keine Mailadresse hinterlegt'}</span><span className="mt-1 block text-xs text-[color:var(--muted)]">{[messageRoles.find(role=>role.value===user.role)?.label,user.qualRD,user.qualAusb==='AUSBILDER'?'Ausbilder':null].filter(Boolean).join(' · ')}</span></span></label>;
   })}</div>{!filtered.length?<p className="py-4 text-center text-sm text-[color:var(--muted)]">Keine passenden Benutzer gefunden.</p>:null}<Pagination {...paged}/></div>:null}
   {tab==='EMAIL'?<div className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Weitere E-Mail-Adresse" type="email" disabled={disabled} className="ui-input min-w-0 flex-1 text-sm" value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addEmail();}}} placeholder="mail@beispiel.de"/><button type="button" className="ui-button-secondary" disabled={disabled||!draft.trim()} onClick={addEmail}>+ Hinzufügen</button></div>{error?<p role="alert" className="text-xs text-[color:var(--danger)]">{error}</p>:null}<div className="flex flex-wrap gap-2">{value.emails.map(email=><span key={email} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs">{emailExtra?.(email)}<span className="break-all">{email}</span><button type="button" disabled={disabled} aria-label={`${email} entfernen`} className="min-h-9 min-w-9 rounded-lg font-semibold hover:bg-[var(--surface)]" onClick={()=>onChange({...value,emails:value.emails.filter(item=>item!==email)})}>×</button></span>)}</div>{!value.emails.length?<p className="text-xs text-[color:var(--muted)]">Noch keine zusätzlichen Adressen hinzugefügt.</p>:null}</div>:null}
  </div>
 </div>;
}
