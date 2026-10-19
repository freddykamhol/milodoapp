"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { ViewerRole } from "@/lib/navigation";
import { usePropState } from "@/app/_components/state";
import { NavigationMenu } from "./navigation-menu";
import { IconMenu } from "./icons";

export function MobileNav({role,qualAusb}:{role:ViewerRole|null;qualAusb?:string|null}){
 const pathname=usePathname(),[open,setOpen]=usePropState(pathname,()=>false);
 const trigger=React.useRef<HTMLButtonElement>(null),panel=React.useRef<HTMLDivElement>(null),backdrop=React.useRef<HTMLDivElement>(null),close=React.useRef<HTMLButtonElement>(null),id=React.useId();
 React.useEffect(()=>{
  if(!open)return;
  const triggerElement=trigger.current;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const siblings=Array.from(document.body.children).filter((element):element is HTMLElement=>element instanceof HTMLElement&&element!==backdrop.current);
  const inert=siblings.map(element=>element.inert);
  siblings.forEach(element=>{element.inert=true;});
  close.current?.focus();
  panel.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block:"nearest"});
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setOpen(false);}
   if(event.key==="Tab"){
    const controls=Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]')??[]).filter(element=>element.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!panel.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener("keydown",keyboard);
  const desktop=window.matchMedia("(min-width:1024px)");
  const resize=()=>{if(desktop.matches)setOpen(false);};
  desktop.addEventListener("change",resize);
  return()=>{document.removeEventListener("keydown",keyboard);desktop.removeEventListener("change",resize);document.body.style.overflow=previousOverflow;siblings.forEach((element,index)=>{element.inert=inert[index];});triggerElement?.focus();};
 },[open,setOpen]);
 return <><button ref={trigger} type="button" className="app-mobile-trigger" aria-label="Menü öffnen" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(true)}><IconMenu className="h-5 w-5"/></button>
  {open?createPortal(<div ref={backdrop} className="app-mobile-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
   <div ref={panel} id={id} role="dialog" aria-modal="true" aria-label="Navigation" className="app-mobile-panel">
    <div className="app-mobile-header"><div><span className="app-mobile-eyebrow">MILODO MEDICAL</span><h2>Navigation</h2></div><button ref={close} type="button" className="app-mobile-close" aria-label="Menü schließen" onClick={()=>setOpen(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
    <div className="app-mobile-scroll"><NavigationMenu role={role} qualAusb={qualAusb} onNavigate={()=>setOpen(false)}/></div>
    <div className="app-mobile-footer">Organisation. Team. Einsatz.</div>
   </div>
  </div>,document.body):null}
 </>;
}
