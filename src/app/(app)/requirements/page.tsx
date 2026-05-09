import { AppShell } from "../_components/app-shell";
import { Card } from "../_components/ui";

import { notFound, redirect } from "next/navigation";

import { and, asc, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { appointments, customers } from "@/db/schema";
import { CustomerRequestsClient } from "./_components/customer-requests-client";

export default async function RequirementsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const isAllowed = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  if (!isAllowed) notFound();

  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);

  const rows = await db
    .select({
      appointmentId: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      einsatzort: appointments.einsatzort,
      customerId: customers.id,
      customerName: customers.name,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(
      and(
        eq(appointments.state, "OPEN"),
        gte(appointments.startAt, cutoff),
        eq(appointments.approved, false),
      ),
    )
    .orderBy(asc(appointments.startAt), asc(customers.name))
    .limit(200);

  return (
    <AppShell title="Anforderungen" subtitle="Qualifikationen, Mindestbesetzung und Vorgaben zentral verwalten.">
      <Card
        title="Angeforderte Dienste"
        description="Kundenanforderungen prüfen und freigeben oder ablehnen."
      >
        <CustomerRequestsClient
          initial={rows.map((r) => ({
            appointmentId: r.appointmentId,
            startAt: r.startAt.toISOString(),
            endAt: r.endAt ? r.endAt.toISOString() : null,
            title: r.title,
            einsatzort: r.einsatzort,
            customerId: r.customerId,
            customerName: r.customerName,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      </Card>
    </AppShell>
  );
}
