import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../../_components/app-shell";
import { Card } from "../../../_components/ui";
import { CustomerFormClient } from "../../new/_components/customer-form-client";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export default async function CustomerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const canManage = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  if (!canManage) notFound();

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();

  const customer = await db.query.customers.findFirst({ where: (t, { eq }) => eq(t.id, customerId) });
  if (!customer) notFound();

  return (
    <AppShell title="Kunde bearbeiten" subtitle={customer.name}>
      <Card
        title="Stammdaten"
        description="Änderungen werden sofort übernommen."
        actions={
          <Link href="/customers" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
            Zurück
          </Link>
        }
      >
        <CustomerFormClient
          mode="edit"
          customerId={customer.id}
          initial={{
            name: customer.name,
            mainBereich: customer.mainBereich,
            contactName: customer.contactName,
            street: customer.street,
            houseNumber: customer.houseNumber,
            plz: customer.plz,
            city: customer.city,
            email: customer.email,
            phone: customer.phone,
          }}
        />
      </Card>
    </AppShell>
  );
}
