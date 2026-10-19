import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { ResponsibilitiesClient } from "./client";
export default async function ResponsibilitiesSettingsPage() { const viewer = await getViewer(); if (!viewer) redirect("/login"); if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") notFound(); return <ResponsibilitiesClient />; }
