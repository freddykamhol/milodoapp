import { loadFleetFeed } from "@/lib/fleet-read-model";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { VehiclesClient } from "./vehicles-client";

export default async function VehiclesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login"); if(viewer.role==="KUNDE")redirect("/dashboard");
  if (viewer.role === "PERSONAL") notFound();
  return <AppShell title="Fahrzeuge" subtitle="Übersicht und aktueller Belegungsstatus der Flotte."><VehiclesClient initialData={await loadFleetFeed(viewer.role,"vehicles")} role={viewer.role} initialTab="vehicles" showTabs={false} /></AppShell>;
}
