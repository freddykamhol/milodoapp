"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavigationHref, navigationGroupsFor, type ViewerRole } from "@/lib/navigation";

const paths:Record<string,string>={
 home:"m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
 calendar:"M4 5h16v16H4zM8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2",
 services:"M8 5H4v16h16V5h-4M8 3h8v4H8zM8 12h8m-8 4h5",
 vehicle:"m5 6-2 7v6h3v-3h12v3h3v-6l-2-7H5zM3 12h18M7 14h1m8 0h1",
 inventory:"m3 7 9-4 9 4v11l-9 4-9-4V7zm0 0 9 4 9-4m-9 4v11M7 5l10 4",
 team:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-4M13 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
 clock:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2",
 documents:"M14 3H5v18h14V8l-5-5zm0 0v5h5M8 12h8m-8 4h8",
 profile:"M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
 settings:"M4 7h16M4 17h16M8 4v6m8 4v6",
 customers:"M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 8v-4h6v4",
 mail:"M3 5h18v14H3zM3 5l9 7 9-7",
 edit:"m4 16 12-12 4 4L8 20H4v-4zm9-9 4 4",
 form:"M5 3h14v18H5zM9 7h6m-6 5h6m-6 5h3",
};
function MenuIcon({name}:{name?:string}){return <svg className="app-nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name??"services"]??paths.services}/></svg>;}

export function NavigationMenu({role,qualAusb,onNavigate}:{role:ViewerRole|null;qualAusb?:string|null;onNavigate?:()=>void}){
 const pathname=usePathname(),groups=navigationGroupsFor(role,qualAusb),activeHref=activeNavigationHref(pathname,groups);
 const [search,setSearch]=React.useState("");
 const [expansion,setExpansion]=React.useState<{path:string;values:Record<string,boolean>}>({path:pathname,values:{}});
 const id=React.useId(),query=search.trim().toLocaleLowerCase("de");
 const match=(text:string)=>text.toLocaleLowerCase("de").includes(query);
 const filtered=groups.map(group=>({...group,items:group.items.filter(item=>!query||match(group.label)||match(item.label)||item.children?.some(child=>match(child.label)))})).filter(group=>group.items.length);
 return <div className="app-nav-content">
  <label className="app-nav-search"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input type="search" aria-label="Menü durchsuchen" placeholder="Menü durchsuchen …" value={search} onChange={event=>setSearch(event.target.value)}/></label>
  <nav aria-label="Hauptnavigation" className="app-nav-groups">{filtered.map((group,index)=><section key={group.label} className="app-nav-group" aria-labelledby={id+"-group-"+index}>
   <h2 id={id+"-group-"+index} className="app-nav-heading">{group.label}</h2>
   <ul className="app-nav-list">{group.items.map(item=>{
    const children=item.children,inside=!!children?.some(child=>child.href===activeHref);
    const expanded=query?true:((expansion.path===pathname?expansion.values[item.label]:undefined)??inside);
    const panelId=id+"-submenu-"+item.icon,parentActive=!children&&activeHref===item.href;
    return <li key={item.label} className={inside?"app-nav-item is-within":"app-nav-item"}>
     <div className="app-nav-row"><Link className={"app-nav-link"+(parentActive?" is-active":"")} href={item.href} aria-current={parentActive?"page":undefined} onClick={onNavigate}><MenuIcon name={item.icon}/><span>{item.label}</span>{parentActive?<span className="app-nav-current" aria-hidden="true"/>:null}</Link>
      {children?<button type="button" className="app-nav-toggle" aria-label={item.label+" Untermenü"} aria-expanded={expanded} aria-controls={panelId} onClick={()=>setExpansion(previous=>({path:pathname,values:{...(previous.path===pathname?previous.values:{}),[item.label]:!expanded}}))}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></button>:null}
     </div>
     {children?<ul id={panelId} className="app-nav-submenu" hidden={!expanded}>{children.filter(child=>!query||match(group.label)||match(item.label)||match(child.label)).map(child=><li key={child.href}><Link href={child.href} className={"app-nav-sublink"+(child.href===activeHref?" is-active":"")} aria-current={child.href===activeHref?"page":undefined} onClick={onNavigate}><span>{child.label}</span>{child.href===activeHref?<span className="app-nav-current" aria-hidden="true"/>:null}</Link></li>)}</ul>:null}
    </li>;
   })}</ul>
  </section>)}</nav>
  {!filtered.length?<p className="app-nav-empty" role="status">Keine Menüpunkte gefunden.</p>:null}
 </div>;
}
