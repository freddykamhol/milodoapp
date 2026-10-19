import {redirect} from 'next/navigation';
import {asc} from 'drizzle-orm';
import {getViewer} from '@/lib/viewer';
import {db} from '@/lib/db';
import {customers} from '@/db/schema';
import {AppShell} from '../../_components/app-shell';
import {AppointmentCreateClient} from '../../appointments/new/_components/appointment-create-client';
export default async function NewCoursePage(){const viewer=await getViewer();if(!viewer)redirect('/login');if(viewer.role!=='ADMIN'&&viewer.role!=='VERWALTUNG')redirect('/courses');const rows=await db.select({id:customers.id,name:customers.name,contactName:customers.contactName,street:customers.street,houseNumber:customers.houseNumber,plz:customers.plz,city:customers.city,email:customers.email,phone:customers.phone}).from(customers).orderBy(asc(customers.name));return <AppShell title="Kurs erstellen" subtitle="Kursart und Beginn wählen – die Dauer wird automatisch festgelegt."><AppointmentCreateClient customers={rows} fixedServiceType="ERSTE_HILFE"/></AppShell>;}
