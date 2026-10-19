import { loadFleetFeed } from "@/lib/fleet-read-model";
import { redirect } from "next/navigation";
import { AppShell } from "../../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { VehiclesClient } from "../vehicles-client";
export default async function VehicleTripsPage() { const viewer = await getViewer(); if (!viewer) redirect("/login"); if(viewer.role==="KUNDE")redirect("/dashboard"); return <AppShell title="Fahrtenbuch" subtitle="Fahrtenübersicht und Einträge"><VehiclesClient initialData={await loadFleetFeed(viewer.role,"trips")} role={viewer.role} initialTab="trips" showTabs={false} /></AppShell>; }
