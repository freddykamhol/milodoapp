import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../_components/app-shell";
import { Card } from "../../_components/ui";
import { db } from "@/lib/db";
import { customers } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

import { AppointmentCreateClient } from "./_components/appointment-create-client";

export default async function AppointmentNewPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const isAdmin = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const isCustomer = viewer.role === "KUNDE";

  if (!isAdmin && !isCustomer) {
    return (
      <AppShell title="Termin erstellen" subtitle="Nur Admin/Verwaltung oder Kundenaccounts dürfen Termine anlegen.">
        <Card title="Kein Zugriff" description="Du hast keine Berechtigung, Termine zu erstellen.">
          <p className="text-sm text-[color:var(--muted)]">Melde dich als Admin/Verwaltung oder als Kunde an.</p>
        </Card>
      </AppShell>
    );
  }

  if (isCustomer) {
    const customerRow = await db.query.customers.findFirst({
      where: (t, { eq }) => eq(t.accountUserId, viewer.id),
    });

    if (!customerRow) {
      return (
        <AppShell title="Termin erstellen" subtitle="Bitte zuerst den Kundenaccount verknüpfen.">
          <Card title="Kein Kundenkonto gefunden" description="Zu diesem Login ist kein Kunde verknüpft.">
            <p className="text-sm text-[color:var(--muted)]">
              Admin/Verwaltung muss den Kunden unter „Kunden“ mit deinem Account verbinden.
            </p>
          </Card>
        </AppShell>
      );
    }

    return (
      <AppShell title="Termin erstellen" subtitle="Dienst anfordern (wird nach Prüfung freigegeben).">
        <AppointmentCreateClient
          customers={[
            {
              id: customerRow.id,
              name: customerRow.name,
              contactName: customerRow.contactName,
              street: customerRow.street,
              houseNumber: customerRow.houseNumber,
              plz: customerRow.plz,
              city: customerRow.city,
              email: customerRow.email,
              phone: customerRow.phone,
            },
          ]}
          fixedCustomerId={customerRow.id}
          fixedServiceType={customerRow.mainBereich}
          mode="customer"
        />
      </AppShell>
    );
  }

  const customerRows = await db
    .select({
      id: customers.id,
      name: customers.name,
      contactName: customers.contactName,
      street: customers.street,
      houseNumber: customers.houseNumber,
      plz: customers.plz,
      city: customers.city,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .orderBy(customers.name);

  return (
    <AppShell title="Termin erstellen" subtitle="Neuen Dienst anlegen.">
      <AppointmentCreateClient customers={customerRows} mode="admin" />
    </AppShell>
  );
}
