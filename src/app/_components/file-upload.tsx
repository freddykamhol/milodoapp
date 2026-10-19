"use client";
/* eslint-disable @next/next/no-img-element -- Local blob previews must not use the remote image optimizer. */
import * as React from "react";

function FilePreview({file}:{file:File}){
 const [url,setUrl]=React.useState(''),[text,setText]=React.useState('');
 // The preview URL is an external browser resource owned by this effect.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 React.useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);setText('');let active=true;if(/^(text\/|application\/json)/.test(file.type)||/\.(csv|txt|json)$/i.test(file.name))void file.slice(0,4096).text().then(value=>{if(active)setText(value);});return()=>{active=false;URL.revokeObjectURL(next);};},[file]);
 if(!url)return null;
 if(/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type))return <a href={url} target="_blank" rel="noreferrer" aria-label={`${file.name} in Vorschau öffnen`}><img src={url} alt={file.name} className="h-32 w-full rounded-xl bg-[var(--surface-2)] object-contain" /></a>;
 if(file.type==='application/pdf')return <div><iframe title={`Vorschau ${file.name}`} src={url} sandbox="" className="h-48 w-full rounded-xl border border-[var(--border)]"/><a className="mt-2 inline-block text-xs font-semibold text-[color:var(--accent)]" href={url} target="_blank" rel="noreferrer">PDF-Vorschau öffnen</a></div>;
 if(text)return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--surface-2)] p-3 text-xs">{text}</pre>;
 return <p className="rounded-xl bg-[var(--surface-2)] p-3 text-xs text-[color:var(--muted)]">{file.type||'Datei'} · Für diesen Dateityp ist keine eingebettete Vorschau verfügbar.</p>;
}
export function FilePreviews({files,onRemove,disabled=false}:{files:readonly File[];onRemove:(index:number)=>void;disabled?:boolean}){
 return files.length?<ul className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">{files.map((file,index)=><li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="min-w-0 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{file.name}</p><p className="mt-1 text-xs text-[color:var(--muted)]">{(file.size/1024/1024).toLocaleString('de-DE',{maximumFractionDigits:2})} MB</p></div><button type="button" disabled={disabled} aria-label={`${file.name} entfernen`} className="ui-button-secondary shrink-0" onClick={()=>onRemove(index)}>Entfernen</button></div><FilePreview file={file}/></li>)}</ul>:null;
}
export function FileUpload({files,onChange,label='Anhänge',accept,multiple=true,disabled=false,hint}:{files:File[];onChange:(files:File[])=>void;label?:string;accept?:string;multiple?:boolean;disabled?:boolean;hint?:string}){
 const id=React.useId(),input=React.useRef<HTMLInputElement>(null);
 return <div className="min-w-0">
  <label htmlFor={id} className="text-xs font-semibold">{label}</label>
  <input ref={input} id={id} aria-label={label} tabIndex={-1} className="sr-only" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={event=>{const added=Array.from(event.currentTarget.files??[]);if(added.length)onChange(multiple?[...files,...added.filter(file=>!files.some(old=>old.name===file.name&&old.size===file.size&&old.lastModified===file.lastModified))]:added.slice(0,1));event.currentTarget.value='';}}/>
  <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3">
   <button type="button" className="ui-button-secondary" disabled={disabled} aria-controls={id} onClick={()=>input.current?.click()}>{multiple?'Dateien auswählen':'Datei auswählen'}</button>
   <p className="text-xs text-[color:var(--muted)]" aria-live="polite">{files.length?`${files.length} ${files.length===1?'Datei':'Dateien'} ausgewählt`:'Noch keine Datei ausgewählt'}</p>
  </div>
  {hint?<p className="mt-2 text-xs text-[color:var(--muted)]">{hint}</p>:null}
  <FilePreviews files={files} disabled={disabled} onRemove={index=>onChange(files.filter((_,i)=>i!==index))}/>
 </div>;
}
/** Select, inspect and remove files before any upload takes place. */
export function StagedUpload({label,multiple=true,onUpload,disabled=false}:{label:string;multiple?:boolean;onUpload:(files:File[])=>Promise<boolean|void>;disabled?:boolean}){
 const [files,setFiles]=React.useState<File[]>([]),[busy,setBusy]=React.useState(false);
 return <div className="w-full min-w-0 space-y-3"><FileUpload files={files} onChange={setFiles} label={label} multiple={multiple} accept="image/png,image/jpeg,image/webp,image/gif,image/avif" disabled={disabled||busy}/>{files.length?<button type="button" disabled={disabled||busy} className="ui-button-primary" onClick={async()=>{if(busy)return;setBusy(true);try{if(await onUpload(files)!==false)setFiles([]);}finally{setBusy(false);}}}>{busy?'Wird hochgeladen …':'Auswahl hochladen'}</button>:null}</div>;
}
