import {redirect} from "next/navigation";
import {getViewer} from "@/lib/viewer";
import {loadCalendarEvents} from "@/lib/calendar-read-model";
import {AppShell} from "../_components/app-shell";
import {CalendarView} from "./_components/calendar-view";
export default async function CalendarPage({searchParams}:{searchParams?:Promise<{date?:string}>}){
 const viewer=await getViewer();if(!viewer)redirect("/login");
 const query=await searchParams,requested=query?.date?new Date(query.date):null;
 const anchor=requested&&Number.isFinite(+requested)?requested:new Date(),from=new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth(),-7)),to=new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+1,15));
 const data=await loadCalendarEvents(viewer,from,to);
 return <AppShell title="Kalender" subtitle="Dienste, Wartungen und Mangeltermine im Überblick."><CalendarView initialAnchor={anchor.toISOString()} initialData={{...data,from:from.toISOString(),to:to.toISOString()}}/></AppShell>;
}
