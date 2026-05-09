import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../../_components/app-shell";
import { Badge, Card } from "../../../_components/ui";
import { db } from "@/lib/db";
import { customers } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

import { AppointmentEditClient } from "./_components/appointment-edit-client";

export default async function AppointmentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const canEdit = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) notFound();

  const row = await db.query.appointments.findFirst({
    where: (t, { eq }) => eq(t.id, appointmentId),
  });
  if (!row) notFound();

  const customerRows = await db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(customers.name);

  return (
    <AppShell title="Termin bearbeiten" subtitle="Start/Ende, Ort und Details anpassen.">
      <Card
        title={canEdit ? "Bearbeiten" : "Kein Zugriff"}
        description={canEdit ? "Änderungen werden sofort gespeichert." : "Nur Admin und Verwaltung dürfen Termine bearbeiten."}
        actions={
          <Link href="/appointments" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
            Zurück
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="muted">Termin #{row.id}</Badge>
          <Badge tone="muted">{row.bereich}</Badge>
          {row.dienstart ? <Badge tone="muted">{row.dienstart}</Badge> : null}
        </div>

        {canEdit ? (
          <div className="mt-5">
            <AppointmentEditClient
              appointment={{
                id: row.id,
                startAt: row.startAt.toISOString(),
                endAt: row.endAt ? row.endAt.toISOString() : null,
                title: row.title,
                einsatzort: row.einsatzort,
                customerId: row.customerId,
                bereich: row.bereich,
                dienstart: row.dienstart ?? null,
                staffingStatus: row.staffingStatus,
                state: row.state,
              }}
              customers={customerRows}
            />
          </div>
        ) : null}
      </Card>
    </AppShell>
  );
}
