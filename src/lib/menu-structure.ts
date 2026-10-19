export type ViewerRole = "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
export type NavigationItem = { label: string; href: string; icon?: string; children?: NavigationItem[] };
export type NavigationGroup = { label: string; items: NavigationItem[] };

export function navigationGroupsFor(role: ViewerRole | null, qualAusb: string | null = null): NavigationGroup[] {
 if (!role) return [];
 const account={label:"Mein Konto",items:[{label:"Mein Profil",href:"/profile",icon:"profile"},{label:"Einstellungen",href:"/settings",icon:"settings"}]};
 if(role==="KUNDE")return [{label:"Mein Bereich",items:[{label:"Dashboard",href:"/dashboard",icon:"home"},{label:"Termin erstellen",href:"/appointments/new",icon:"calendar"},{label:"Kurse",href:"/courses",icon:"form"},{label:"Dokumente",href:"/documents/services",icon:"documents"}]},account];
 if(role==="PERSONAL")return [
  {label:"Planung & Einsätze",items:[{label:"Dashboard",href:"/dashboard",icon:"home"},{label:"Kalender",href:"/calendar",icon:"calendar"},{label:"Termine / Dienste",href:"/appointments",icon:"services"},...(qualAusb==="AUSBILDER"?[{label:"Kurse",href:"/courses",icon:"form"}]:[])]},
  {label:"Fahrzeug & Material",items:[
   {label:"Fahrzeuge",href:"/vehicles/trips",icon:"vehicle",children:[{label:"Fahrtenbuch",href:"/vehicles/trips"},{label:"Mängel",href:"/vehicles/defects"}]},
   {label:"Material",href:"/inventory/defects",icon:"inventory",children:[{label:"Mängel",href:"/inventory/defects"}]},
  ]},
  {label:"Team & Personal",items:[{label:"Mitglieder",href:"/members",icon:"team"},{label:"Stunden",href:"/hours",icon:"clock"},{label:"Dokumente",href:"/documents",icon:"documents"}]},
  account,
 ];
 const manager=role==="ADMIN"||role==="VERWALTUNG";
 return [
  {label:"Planung & Einsätze",items:[{label:"Dashboard",href:"/dashboard",icon:"home"},{label:"Kalender",href:"/calendar",icon:"calendar"},{label:"Termine / Dienste",href:"/appointments",icon:"services"},{label:"Kurse",href:"/courses",icon:"form"}]},
  {label:"Fuhrpark & Material",items:[
   {label:"Fahrzeuge",href:manager?"/vehicles":"/vehicles/trips",icon:"vehicle",children:[...(manager?[{label:"Fahrzeugübersicht",href:"/vehicles"}]:[]),{label:"Fahrtenbuch",href:"/vehicles/trips"},{label:"Mängel",href:"/vehicles/defects"}]},
   {label:"Material & Inventar",href:"/inventory/items",icon:"inventory",children:[{label:"Bestand",href:"/inventory/items"},{label:"Prüfungen",href:"/inventory/inspections"},{label:"Mängel",href:"/inventory/defects"}]},
   ...(manager?[{label:"Wartungsfirmen",href:"/maintenance-companies",icon:"customers"}]:[]),
  ]},
  {label:"Team & Personal",items:[{label:"Mitglieder",href:"/members",icon:"team"},{label:"Stunden",href:"/hours",icon:"clock"},{label:"Dokumente",href:"/documents",icon:"documents"},...(manager?[{label:"Nachricht senden",href:"/messages",icon:"mail"},{label:"Personalfragebögen",href:"/personalfrageboegen",icon:"form"}]:[])]},
  ...(manager?[{label:"Verwaltung",items:[{label:"Kunden",href:"/customers",icon:"customers"},{label:"Anforderungen",href:"/requirements",icon:"services"},{label:"Kontaktanfragen",href:"/contactanfragen",icon:"mail"},{label:"Blog",href:"/blog",icon:"edit"}]}]:[]),
  account,
 ];
}
export function navigationFor(role:ViewerRole|null, qualAusb: string | null = null):NavigationItem[]{return navigationGroupsFor(role, qualAusb).flatMap(group=>group.items);}
export function activeNavigationHref(pathname:string,groups:NavigationGroup[]):string|undefined{
 const all=groups.flatMap(group=>group.items.flatMap(item=>item.children??[item]));
 if(pathname==="/inventory")return "/inventory/items";
 return all.filter(item=>pathname===item.href||pathname.startsWith(item.href+"/")).sort((a,b)=>b.href.length-a.href.length)[0]?.href;
}
