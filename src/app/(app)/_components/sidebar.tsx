"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import type { ViewerRole } from "@/lib/navigation";
import { NavigationMenu } from "./navigation-menu";
const TodayInView=React.lazy(()=>import("./today-in-view").then(module=>({default:module.TodayInView})));

export function Sidebar({role,qualAusb}:{role:ViewerRole|null;qualAusb?:string|null}){
 const [todayOpen,setTodayOpen]=React.useState(false);
 return <aside className="app-sidebar" aria-label="Seitennavigation"><div className="app-sidebar-panel">
  <div className="app-sidebar-brand"><Link href="/dashboard" aria-label="MILODO – Dashboard"><Image src="/logo/MILODO.png" alt="MILODO" width={1305} height={350} className="h-[32px] w-auto" priority/></Link><span>Organisation & Einsatz</span></div>
  <div className="app-sidebar-scroll"><NavigationMenu role={role} qualAusb={qualAusb}/>{role&&role!=="KUNDE"?<details className="app-nav-today" onToggle={event=>setTodayOpen(event.currentTarget.open)}><summary>Heute im Blick</summary>{todayOpen?<React.Suspense fallback={<p className="p-3 text-xs">Wird geladen …</p>}><TodayInView/></React.Suspense>:null}</details>:null}</div>
 </div></aside>;
}
