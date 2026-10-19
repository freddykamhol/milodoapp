import { notFound, redirect } from "next/navigation";
import { AppShell } from "../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { InventoryHome } from "./_components/inventory-ui";

export default async function InventoryPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "KUNDE") redirect("/dashboard");
  if (viewer.role === "PERSONAL") notFound();
  return <AppShell title="Material & Inventar" subtitle="Bestände, Geräteprüfungen und Materialbewegungen zentral verwalten."><InventoryHome canManage={viewer.role === "ADMIN" || viewer.role === "VERWALTUNG"} /></AppShell>;
}
