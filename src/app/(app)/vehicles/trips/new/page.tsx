import { redirect } from "next/navigation";
import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { AppShell } from "../../../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { db } from "@/lib/db";
import { appointments, appointmentVehicles, vehicles } from "@/db/schema";
import { TripForm } from "./form";
export default async function NewTrip(){const viewer=await getViewer();if(!viewer)redirect('/login');if(viewer.role==='KUNDE')redirect('/dashboard');const now=new Date().getTime();const [vehicleList,services,assignments]=await Promise.all([db.select({id:vehicles.id,licensePlate:vehicles.licensePlate,mileage:vehicles.mileage}).from(vehicles).where(eq(vehicles.isActive,true)).orderBy(asc(vehicles.licensePlate)),db.select({id:appointments.id,title:appointments.title,startAt:appointments.startAt,endAt:appointments.endAt}).from(appointments).where(and(ne(appointments.state,'CANCELLED'),gte(appointments.startAt,new Date(now-86400000)),lte(appointments.startAt,new Date(now+90*86400000)))).orderBy(asc(appointments.startAt)),db.select({appointmentId:appointmentVehicles.appointmentId,vehicleId:appointmentVehicles.vehicleId}).from(appointmentVehicles)]);return <AppShell title="Fahrtenbuch-Eintrag" subtitle="Fahrt dokumentieren und Kilometerstand aktualisieren."><TripForm vehicles={vehicleList} services={services.map(service=>({...service,vehicleIds:assignments.filter(assignment=>assignment.appointmentId===service.id).map(assignment=>assignment.vehicleId)}))}/></AppShell>;}
