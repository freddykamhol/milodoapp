import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {eq} from "drizzle-orm";
import {getViewer} from "@/lib/viewer";
import {db} from "@/lib/db";
import {vehicleServiceCompanies} from "@/db/schema";
import {AppShell} from "../../_components/app-shell";
import {Card} from "../../_components/ui";
import {CompanyDetails} from "../companies-client";
export default async function MaintenanceCompanyDetail({params}:{params:Promise<{id:string}>}){
 const viewer=await getViewer();if(!viewer)redirect('/login');if(viewer.role!=='ADMIN'&&viewer.role!=='VERWALTUNG')redirect('/dashboard');
 const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)notFound();
 const company=await db.query.vehicleServiceCompanies.findFirst({where:eq(vehicleServiceCompanies.id,id)});if(!company)notFound();
 return <AppShell title={company.name} subtitle="Wartungsfirma · Kontaktdaten und Adresse"><Link className="inline-block text-sm font-semibold text-[color:var(--accent)]" href="/maintenance-companies">← Zur Firmenübersicht</Link><Card title={company.name}><CompanyDetails company={company}/></Card></AppShell>;
}
