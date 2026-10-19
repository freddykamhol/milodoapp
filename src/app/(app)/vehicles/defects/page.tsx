import { loadFleetFeed } from "@/lib/fleet-read-model";
import { redirect } from "next/navigation";
import { AppShell } from "../../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { VehiclesClient } from "../vehicles-client";
export default async function VehicleDefectsPage() { const viewer = await getViewer(); if (!viewer) redirect("/login"); if(viewer.role==="KUNDE")redirect("/dashboard"); return <AppShell title="Fahrzeugmängel" subtitle="Mängelübersicht und Erfassung"><VehiclesClient initialData={await loadFleetFeed(viewer.role,"defects")} role={viewer.role} initialTab="defects" showTabs={false} /></AppShell>; }
