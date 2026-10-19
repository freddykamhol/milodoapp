import {DefectAppointmentsPanel} from "../../../_components/defect-appointments";
import {loadDefectAppointments,loadDefectAppointmentCompanies} from "@/lib/defect-appointments";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AppShell } from "../../../_components/app-shell";
import { DefectDetailView } from "../../../_components/defects";
import { db } from "@/lib/db";
import { vehicleDefects, vehicles } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { vehicleDefectCategories } from "@/lib/defects";
export default async function VehicleDefectDetail({ params }: { params: Promise<{ id: string }> }) {
 const viewer=await getViewer(); if(!viewer)redirect("/login"); if(viewer.role==="KUNDE")redirect("/dashboard");
 const id=Number((await params).id); const [row]=await db.select({defect:vehicleDefects,vehicle:vehicles}).from(vehicleDefects).innerJoin(vehicles,eq(vehicleDefects.vehicleId,vehicles.id)).where(eq(vehicleDefects.id,id)); if(!row)notFound();
 const canManage=viewer.role==="ADMIN"||viewer.role==="VERWALTUNG";
 const termManager=viewer.role==='ADMIN'||viewer.role==='VERWALTUNG';
 const [mangelAppointments,termCompanies]=await Promise.all([loadDefectAppointments({domain:'vehicle',defectId:id}),termManager?loadDefectAppointmentCompanies():Promise.resolve([])]);
 return <AppShell title={row.defect.title} subtitle={`Mangelmeldung - ${row.vehicle.licensePlate}`}><DefectDetailView appointments={<DefectAppointmentsPanel domain="vehicle" defectId={id} defectTitle={row.defect.title} initialAppointments={mangelAppointments} companies={termCompanies} canManage={termManager}/>} defect={row.defect} subject={row.vehicle.licensePlate} subjectHref={canManage?`/vehicles/${row.vehicle.id}`:undefined} backHref="/vehicles/defects" endpoint={`/api/vehicles/defects/${id}`} canManage={canManage} fields={[{label:"Kategorie",value:vehicleDefectCategories[row.defect.category]},{label:"Kilometerstand bei Meldung",value:`${row.defect.mileage.toLocaleString("de-DE")} km`}]}/></AppShell>;
}
