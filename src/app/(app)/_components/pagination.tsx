"use client";
import {usePropState} from "@/app/_components/state";
export function usePagedItems<T>(items:readonly T[],key:unknown,pageSize=50){
 const [requested,setPage]=usePropState(key,()=>1);
 const total=items.length,pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.max(1,Math.min(requested,pages));
 return {items:items.slice((page-1)*pageSize,page*pageSize),page,pages,total,pageSize,setPage};
}
export function Pagination({page,pages,total,pageSize,setPage}:{page:number;pages:number;total:number;pageSize:number;setPage:(page:number)=>void}){
 if(total<=pageSize)return null;
 return <nav aria-label="Ergebnisseiten" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs">
  <p className="text-[color:var(--muted)]" aria-live="polite">{(page-1)*pageSize+1}–{Math.min(page*pageSize,total)} von {total} · Seite {page} von {pages}</p>
  <div className="flex gap-2"><button type="button" className="ui-button-secondary" disabled={page===1} onClick={()=>setPage(page-1)} aria-label="Vorherige Seite">← Zurück</button><button type="button" className="ui-button-secondary" disabled={page===pages} onClick={()=>setPage(page+1)} aria-label="Nächste Seite">Weiter →</button></div>
 </nav>;
}
