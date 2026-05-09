import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../../_components/app-shell";
import { Card } from "../../../_components/ui";

import { db } from "@/lib/db";
import { MemberEditClient } from "./_components/member-edit-client";
import { getViewer } from "@/lib/viewer";

export default async function MemberEditPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "ADMIN") notFound();

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) notFound();

  const member = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  if (!member) notFound();

  const customer =
    member.role === "KUNDE"
      ? await db.query.customers.findFirst({ where: (t, { eq }) => eq(t.accountUserId, member.id) })
      : null;

  return (
    <AppShell title="Mitglied bearbeiten" subtitle={`@${member.username}`}>
      <Card title="Stammdaten" description="Username ist nicht editierbar.">
        <MemberEditClient
          userId={member.id}
          username={member.username}
          role={member.role}
          initial={{
            firstName: member.firstName ?? "",
            lastName: member.lastName ?? "",
            geb: member.geb ? member.geb.toISOString().slice(0, 10) : "",
            strasse: member.strasse ?? "",
            hausnummer: member.hausnummer ?? "",
            plz: member.plz ?? "",
            ort: member.ort ?? "",
            ortErgaenzung: member.ortErgaenzung ?? "",
            email: member.email ?? "",
            telefon: member.telefon ?? "",
            hourlyRateQualRdCents: member.hourlyRateQualRdCents ?? null,
            hourlyRateQualAusbCents: member.hourlyRateQualAusbCents ?? null,
          }}
          customer={
            customer
              ? {
                  id: customer.id,
                  firma: customer.name,
                  ansprechpartner: customer.contactName,
                  strasse: customer.street,
                  hausnummer: customer.houseNumber,
                  plz: customer.plz,
                  ort: customer.city,
                  hauptbereich: customer.mainBereich,
                }
              : null
          }
        />
      </Card>
    </AppShell>
  );
}
