import {redirect} from "next/navigation";
import {asc} from "drizzle-orm";
import {AppShell} from "../_components/app-shell";
import {Card} from "../_components/ui";
import {CompaniesClient} from "./companies-client";
import {db} from "@/lib/db";
import {vehicleServiceCompanies} from "@/db/schema";
import {getViewer} from "@/lib/viewer";

export default async function MaintenanceCompaniesPage(){
 const viewer=await getViewer();if(!viewer)redirect("/login");
 if(viewer.role!=="ADMIN"&&viewer.role!=="VERWALTUNG")redirect("/dashboard");
 const companies=await db.select().from(vehicleServiceCompanies).orderBy(asc(vehicleServiceCompanies.name));
 return <AppShell title="Wartungsfirmen" subtitle="Werkstätten, Prüfstellen und Dienstleister für Fahrzeuge, Material und Medizinprodukte zentral verwalten."><Card><CompaniesClient initialCompanies={companies.map(({id,name,address,street,postalCode,city,phone,email,contactPerson})=>({id,name,address,street,postalCode,city,phone,email,contactPerson}))}/></Card></AppShell>;
}
