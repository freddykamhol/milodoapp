import { redirect } from "next/navigation";

import { AppShell } from "@/app/(app)/_components/app-shell";
import { getViewer } from "@/lib/viewer";
import ContactAnfragenClient from "./contactanfragen-client";

export const runtime = "nodejs";

export default async function ContactAnfragenPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) redirect("/dashboard");

  return (
    <AppShell title="Kontaktanfragen" subtitle="Website-Anfragen, Filter & Detailansicht.">
      <ContactAnfragenClient />
    </AppShell>
  );
}

