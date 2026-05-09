import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../_components/app-shell";
import { Card } from "../_components/ui";
import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { customers, users } from "@/db/schema";
import { CustomersClient } from "./_components/customers-client";

export default async function CustomersPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const canManage = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  if (!canManage) notFound();

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      mainBereich: customers.mainBereich,
      contactName: customers.contactName,
      street: customers.street,
      houseNumber: customers.houseNumber,
      plz: customers.plz,
      city: customers.city,
      email: customers.email,
      accountUserId: customers.accountUserId,
      accountLocked: users.locked,
      accountUsername: users.username,
    })
    .from(customers)
    .leftJoin(users, eq(customers.accountUserId, users.id))
    .orderBy(asc(customers.name), asc(customers.id));

  return (
    <AppShell title="Kunden" subtitle="Kundenverwaltung (Admin/Verwaltung).">
      <Card
        title="Übersicht"
        description={`${rows.length} Kunden`}
        actions={
          <Link href="/customers/new" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
            Kunde anlegen
          </Link>
        }
      >
        <CustomersClient
          initial={rows.map((r) => ({
            id: r.id,
            name: r.name,
            mainBereich: r.mainBereich,
            contactName: r.contactName,
            street: r.street,
            houseNumber: r.houseNumber,
            plz: r.plz,
            city: r.city,
            email: r.email,
            accountUserId: r.accountUserId ?? null,
            accountLocked: typeof r.accountLocked === "boolean" ? r.accountLocked : null,
            accountUsername: r.accountUsername ?? null,
          }))}
        />
      </Card>
    </AppShell>
  );
}
