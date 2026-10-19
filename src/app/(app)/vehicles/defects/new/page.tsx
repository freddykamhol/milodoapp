import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { AppShell } from "../../../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { db } from "@/lib/db";
import { vehicles } from "@/db/schema";
import { DefectForm } from "./form";
export default async function NewDefect({searchParams}:{searchParams:Promise<{vehicleId?:string}>}){const viewer=await getViewer();if(!viewer)redirect('/login');if(viewer.role==='KUNDE')redirect('/dashboard');const list=await db.select({id:vehicles.id,licensePlate:vehicles.licensePlate,mileage:vehicles.mileage}).from(vehicles).orderBy(asc(vehicles.licensePlate));const {vehicleId}=await searchParams;return <AppShell title="Mangel erfassen" subtitle="Mangel dokumentieren und zur Bearbeitung melden."><DefectForm vehicles={list} initialSubject={vehicleId}/></AppShell>;}
