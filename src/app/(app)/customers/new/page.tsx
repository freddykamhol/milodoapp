import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../_components/app-shell";
import { Card } from "../../_components/ui";
import { CustomerFormClient } from "./_components/customer-form-client";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export default async function CustomerNewPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const canManage = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  if (!canManage) notFound();

  return (
    <AppShell title="Kunde anlegen" subtitle="Kundenverwaltung (Admin/Verwaltung).">
      <Card
        title="Neuer Kunde"
        description="Firma, Ansprechpartner, Adresse, Hauptbereich."
        actions={
          <Link href="/customers" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
            Zurück
          </Link>
        }
      >
        <CustomerFormClient
          mode="create"
          initial={{
            name: "",
            mainBereich: "RD_BOERSE",
            contactName: "",
            street: "",
            houseNumber: "",
            plz: "",
            city: "",
            email: "",
            phone: "",
            createAccount: false,
          }}
        />
      </Card>
    </AppShell>
  );
}
