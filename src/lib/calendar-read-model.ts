import {and,asc,eq,gte,lt,ne,or} from "drizzle-orm";
import {loadCourseCalendar} from './course-read-model';
import {courseType} from './course-types';
import {db} from "./db";
import {loadDefectAppointments} from "./defect-appointments";
import {appointmentApplications,appointments,calendarCategoryColors,customers,vehicleMaintenanceAppointments,vehicles,responsibilityRecipients} from "@/db/schema";
export async function loadCalendarEvents(viewer:{id:number;role:string;qualAusb?:string|null},from:Date,to:Date){
  const userId = viewer.id;
  const responsibilityRows = viewer.role === "PERSONAL"
    ? await db.select({ type: responsibilityRecipients.type, recipientType: responsibilityRecipients.recipientType, role: responsibilityRecipients.role, userId: responsibilityRecipients.userId })
        .from(responsibilityRecipients)
        .where(or(eq(responsibilityRecipients.recipientType, "ROLE"), eq(responsibilityRecipients.recipientType, "USER")))
    : [];
  const responsibleFor = (type: "VEHICLE" | "MATERIAL") => viewer.role !== "PERSONAL" || responsibilityRows.some((row) => row.type === type && ((row.recipientType === "ROLE" && row.role === "PERSONAL") || (row.recipientType === "USER" && row.userId === userId)));
  const canSeeVehicleItems = responsibleFor("VEHICLE");
  const canSeeMaterialItems = responsibleFor("MATERIAL");

  const [rows, maintenanceRows, defectRows, courseRows, colorRows] = await Promise.all([db
    .select({
      appointmentId: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      einsatzort: appointments.einsatzort,
      customerName: customers.name,
      bereich: appointments.bereich,
      dienstart: appointments.dienstart,
    })
    .from(appointmentApplications)
    .innerJoin(appointments, eq(appointmentApplications.appointmentId, appointments.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(
      and(
        eq(appointmentApplications.userId, userId),
        eq(appointmentApplications.status, "CONFIRMED"),
        gte(appointments.startAt, from),
        lt(appointments.startAt, to),
        eq(appointments.state, "OPEN"),
        ne(appointments.bereich,'ERSTE_HILFE'),
      ),
    )
    .orderBy(asc(appointments.startAt)),
    viewer.role === "KUNDE" || !canSeeVehicleItems ? Promise.resolve([]) : db.select({ id: vehicleMaintenanceAppointments.id, vehicleId: vehicleMaintenanceAppointments.vehicleId, startAt: vehicleMaintenanceAppointments.startAt, endAt: vehicleMaintenanceAppointments.endAt, title: vehicleMaintenanceAppointments.title, companyName: vehicleMaintenanceAppointments.companyName, address: vehicleMaintenanceAppointments.address, licensePlate: vehicles.licensePlate })
      .from(vehicleMaintenanceAppointments).innerJoin(vehicles, eq(vehicleMaintenanceAppointments.vehicleId, vehicles.id))
      .where(and(gte(vehicleMaintenanceAppointments.startAt, from), lt(vehicleMaintenanceAppointments.startAt, to)))
      .orderBy(asc(vehicleMaintenanceAppointments.startAt)),
    viewer.role==='KUNDE'||(!canSeeVehicleItems&&!canSeeMaterialItems)?Promise.resolve([]):loadDefectAppointments({from,to}).then(rows=>rows.filter(row=>row.domain==='vehicle'?canSeeVehicleItems:canSeeMaterialItems)),
    loadCourseCalendar(viewer,from,to),
    db.select({ category: calendarCategoryColors.category, color: calendarCategoryColors.color }).from(calendarCategoryColors),
  ]);
  const colors = new Map(colorRows.map(row => [row.category, row.color]));

  return ({
    events: [...rows.map((r) => ({
      id: `appointment-${r.appointmentId}`,
      href: `/appointments/${r.appointmentId}`,
      kind: "APPOINTMENT" as const,
      appointmentId: r.appointmentId,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt ? r.endAt.toISOString() : null,
      title: r.title,
      einsatzort: r.einsatzort,
      customerName: r.customerName ?? null,
      bereich: r.bereich,
      dienstart: r.dienstart ?? null,
      color: colors.get(r.bereich) ?? null,
      meta: r.customerName ? `${r.customerName} · ${r.einsatzort}` : r.einsatzort,
    })), ...maintenanceRows.map((r) => ({
      id: `vehicle-maintenance-${r.id}`,
      href: `/vehicles/${r.vehicleId}`,
      kind: "VEHICLE_MAINTENANCE" as const,
      appointmentId: null,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt?.toISOString() ?? null,
      title: `${r.licensePlate} · ${r.title}`,
      einsatzort: "Wartung",
      customerName: null,
      bereich: "FAHRZEUGWARTUNG",
      color: colors.get("FAHRZEUGWARTUNG") ?? null,
      dienstart: null,
      meta: `${r.companyName} · ${r.address}`,
    })), ...defectRows.map(row=>({
      id:`defect-appointment-${row.id}`,href:row.defectHref,kind:"DEFECT_APPOINTMENT" as const,appointmentId:null,
      startAt:row.startAt,endAt:row.endAt,title:`${row.assetLabel} · ${row.title}`,einsatzort:row.location,
      customerName:row.companyName||null,bereich:"MANGELTERMIN",dienstart:null,color: colors.get("MANGELTERMIN") ?? null,
      meta:[row.defectTitle,row.companyName,row.location,row.description].filter(Boolean).join(' · '),
    })), ...courseRows.map(row=>({id:`course-${row.id}`,href:`/courses/${row.id}`,kind:'COURSE' as const,appointmentId:row.id,startAt:row.startAt.toISOString(),endAt:row.endAt?.toISOString()??null,title:row.title,einsatzort:row.location,customerName:row.customerName,bereich:'ERSTE_HILFE' as const,dienstart:null,color: colors.get("ERSTE_HILFE") ?? null,meta:[courseType(row.courseType)?.label,row.customerName,row.location].filter(Boolean).join(' · ')}))].sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)),
  });
}

/** Exports share the same role filters and event set as the visible calendar. */
export async function loadCalendarExportRows(viewer:{id:number;role:string;qualAusb?:string|null},from:Date,to:Date){
 const {events}=await loadCalendarEvents(viewer,from,to);
 return events.map(event=>({...event,eventId:event.id,startAt:new Date(event.startAt),endAt:event.endAt?new Date(event.endAt):null,customerName:event.customerName??'',einsatzort:event.kind==='VEHICLE_MAINTENANCE'?event.meta:event.einsatzort}));
}

