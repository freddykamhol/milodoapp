"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated private files must retain their protected URL. */
import * as React from "react";
export function StoredFile({name,mimeType,url,onRemove,disabled=false}:{name:string;mimeType:string;url:string;onRemove?:()=>void;disabled?:boolean}){
 const [open,setOpen]=React.useState(false);const image=/^image\/(png|jpeg|webp|gif|avif)$/.test(mimeType),pdf=mimeType==='application/pdf';const preview=url+(url.includes('?')?'&':'?')+'inline=1';
 return <div className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-all text-sm font-semibold">{name}</p><div className="flex flex-wrap gap-2">{image||pdf?<button type="button" className="ui-button-secondary" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Vorschau schließen':'Vorschau'}</button>:null}<a href={url} className="ui-button-secondary">Download</a>{onRemove?<button type="button" className="ui-button-secondary" disabled={disabled} onClick={onRemove}>Löschen</button>:null}</div></div>{open?(image?<img src={preview} alt={name} className="max-h-80 w-full rounded-lg object-contain"/>:<iframe title={`Vorschau ${name}`} src={preview} sandbox="" className="h-80 w-full rounded-lg border border-[var(--border)]"/>):null}</div>;
}
