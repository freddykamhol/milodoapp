import {DefectAppointmentsPanel} from "../../../_components/defect-appointments";
import {loadDefectAppointments,loadDefectAppointmentCompanies} from "@/lib/defect-appointments";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AppShell } from "../../../_components/app-shell";
import { DefectDetailView } from "../../../_components/defects";
import { db } from "@/lib/db";
import { inventoryDefects, inventoryItems } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
export default async function InventoryDefectDetail({params}:{params:Promise<{id:string}>}){
 const viewer=await getViewer();if(!viewer)redirect("/login");if(viewer.role==="KUNDE")redirect("/dashboard");const id=Number((await params).id);
 const [row]=await db.select({defect:inventoryDefects,item:inventoryItems}).from(inventoryDefects).innerJoin(inventoryItems,eq(inventoryDefects.itemId,inventoryItems.id)).where(eq(inventoryDefects.id,id));if(!row)notFound();
 const termManager=viewer.role==='ADMIN'||viewer.role==='VERWALTUNG';
 const [mangelAppointments,termCompanies]=await Promise.all([loadDefectAppointments({domain:'inventory',defectId:id}),termManager?loadDefectAppointmentCompanies():Promise.resolve([])]);
 return <AppShell title={row.defect.title} subtitle={`Mangelmeldung - ${row.item.inventoryNumber||row.item.name}`}><DefectDetailView appointments={<DefectAppointmentsPanel domain="inventory" defectId={id} defectTitle={row.defect.title} initialAppointments={mangelAppointments} companies={termCompanies} canManage={termManager}/>} defect={row.defect} subject={`${row.item.name}${row.item.inventoryNumber?` - ${row.item.inventoryNumber}`:""}`} subjectHref={`/inventory/items/${row.item.id}`} backHref="/inventory/defects" endpoint={`/api/inventory/defects/${id}`} canManage={viewer.role==="ADMIN"||viewer.role==="VERWALTUNG"} fields={[{label:"Standort",value:row.item.location||"-"}]}/></AppShell>;
}
