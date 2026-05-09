import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";

import { AppShell } from "../../_components/app-shell";
import { db } from "@/lib/db";
import {
  appointmentApplications,
  appointmentFiles,
  appointmentRequirements,
  appointmentSectionMembers,
  appointmentSections,
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

  const canAdmin = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";

  const [customer, requirements, files, apps, sections] = await Promise.all([
    db.query.customers.findFirst({ where: (t, { eq }) => eq(t.id, appointment.customerId) }),
    db.select().from(appointmentRequirements).where(eq(appointmentRequirements.appointmentId, appointmentId)),
    db.select().from(appointmentFiles).where(eq(appointmentFiles.appointmentId, appointmentId)).orderBy(asc(appointmentFiles.id)),
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/appointments" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
          Zurück
        </Link>
        {canAdmin ? (
          <Link
            href={`/appointments/${appointment.id}/edit`}
            className="text-xs font-semibold text-[color:var(--accent)] hover:underline"
          >
            Bearbeiten
          </Link>
        ) : null}
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
        files={files.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes }))}
        applications={apps}
        sections={sections.map((s) => ({ id: s.id, title: s.title, sortOrder: s.sortOrder }))}
        sectionMembers={sectionMembers}
        allMembers={allMembers.filter((m) => m.role !== "KUNDE" && !m.locked)}
      />
    </AppShell>
  );
}
