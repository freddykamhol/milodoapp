import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";

import { AppShell } from "../../_components/app-shell";
import { db } from "@/lib/db";
import {
  appointmentApplications,
  appointmentRequirements,
  appointmentSectionMembers,
  appointmentSections,
  appointmentVehicleMembers,
  appointmentVehicles,
  vehicles,
  users,
} from "@/db/schema";

import { AppointmentDetailsClient } from "./_components/appointment-details-client";
import { getViewer } from "@/lib/viewer";

export default async function AppointmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) notFound();

  const appointment = await db.query.appointments.findFirst({
    where: (t, { eq }) => eq(t.id, appointmentId),
  });
  if (!appointment) notFound();
  if (appointment.bereich === "ERSTE_HILFE") redirect(`/courses/${appointment.id}`);

  const canAdmin = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";

  const [customer, requirements, apps, sections, vehicleAssignments, vehicleList] = await Promise.all([
    db.query.customers.findFirst({ where: (t, { eq }) => eq(t.id, appointment.customerId) }),
    db.select().from(appointmentRequirements).where(eq(appointmentRequirements.appointmentId, appointmentId)),
    db
      .select({
        userId: users.id,
        username: users.username,
        role: users.role,
        qualRD: users.qualRD,
        qualAusb: users.qualAusb,
        status: appointmentApplications.status,
        appRole: appointmentApplications.role,
        adminNote: appointmentApplications.adminNote,
      })
      .from(appointmentApplications)
      .innerJoin(users, eq(appointmentApplications.userId, users.id))
      .where(eq(appointmentApplications.appointmentId, appointmentId))
      .orderBy(asc(users.username)),
    db
      .select()
      .from(appointmentSections)
      .where(eq(appointmentSections.appointmentId, appointmentId))
      .orderBy(asc(appointmentSections.sortOrder), asc(appointmentSections.id)),
    db
      .select({ assignmentId: appointmentVehicles.id, vehicleId: vehicles.id, licensePlate: vehicles.licensePlate, type: vehicles.type, userId: appointmentVehicleMembers.userId, username: users.username, qualRD: users.qualRD, qualAusb: users.qualAusb })
      .from(appointmentVehicles)
      .innerJoin(vehicles, eq(appointmentVehicles.vehicleId, vehicles.id))
      .leftJoin(appointmentVehicleMembers, eq(appointmentVehicleMembers.appointmentVehicleId, appointmentVehicles.id))
      .leftJoin(users, eq(appointmentVehicleMembers.userId, users.id))
      .where(eq(appointmentVehicles.appointmentId, appointmentId))
      .orderBy(asc(appointmentVehicles.sortOrder), asc(appointmentVehicles.id)),
    canAdmin ? db.select({ id: vehicles.id, licensePlate: vehicles.licensePlate, type: vehicles.type }).from(vehicles).orderBy(asc(vehicles.licensePlate)) : [],
  ]);

  if (viewer.role === "KUNDE") {
    if (!customer || customer.accountUserId !== viewer.id) notFound();
  }

  const allMembers = canAdmin
    ? await db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          qualRD: users.qualRD,
          qualAusb: users.qualAusb,
          locked: users.locked,
        })
        .from(users)
        .orderBy(asc(users.username))
    : [];
  const canDownloadDutyPlan = canAdmin || apps.some((app) => app.userId === viewer.id && app.status === "CONFIRMED");

  const sectionIds = sections.map((s) => s.id);
  const sectionMembers = sectionIds.length
    ? await db
        .select({
          sectionId: appointmentSectionMembers.sectionId,
          userId: users.id,
          username: users.username,
          qualRD: users.qualRD,
          qualAusb: users.qualAusb,
        })
        .from(appointmentSectionMembers)
        .innerJoin(users, eq(appointmentSectionMembers.userId, users.id))
        .where(inArray(appointmentSectionMembers.sectionId, sectionIds))
        .orderBy(asc(users.username))
    : [];

  return (
    <AppShell title="Termin Details" subtitle={`#${appointment.id} • ${appointment.title}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href="/appointments" className="ui-button-secondary">Zurück</Link>
          {canDownloadDutyPlan ? <a href={`/api/appointments/${appointment.id}/duty-plan`} className="ui-button-secondary">Dienstplan herunterladen</a> : null}
        </div>
        {canAdmin ? <Link href={`/appointments/${appointment.id}/edit`} className="ui-button-primary">Termin bearbeiten</Link> : null}
      </div>

      <AppointmentDetailsClient
        viewer={{ id: viewer.id, role: viewer.role, qualRD: viewer.qualRD ?? null, qualAusb: viewer.qualAusb ?? null }}
        canAdmin={canAdmin}
        appointment={{
          id: appointment.id,
          startAt: appointment.startAt,
          endAt: appointment.endAt,
          title: appointment.title,
          einsatzort: appointment.einsatzort,
          customerId: appointment.customerId,
          approved: appointment.approved,
          bereich: appointment.bereich,
          dienstart: appointment.dienstart,
          eventName: appointment.eventName,
          notes: appointment.notes,
          detailsJson: appointment.detailsJson,
          staffingStatus: appointment.staffingStatus,
          state: appointment.state,
          targetUserId: appointment.targetUserId,
        }}
        customer={
          customer
            ? {
                id: customer.id,
                name: customer.name,
                contactName: customer.contactName,
                street: customer.street,
                houseNumber: customer.houseNumber,
                plz: customer.plz,
                city: customer.city,
                email: customer.email,
                phone: customer.phone,
              }
            : null
        }
        requirements={requirements.map((r) => ({ kind: r.kind, value: r.value, minCount: r.minCount }))}
        applications={apps}
        sections={sections.map((s) => ({ id: s.id, title: s.title, sortOrder: s.sortOrder }))}
        sectionMembers={sectionMembers}
        allMembers={allMembers.filter((m) => m.role !== "KUNDE" && !m.locked)}
        vehicleAssignments={vehicleAssignments}
        vehicleList={vehicleList}
      />
    </AppShell>
  );
}
