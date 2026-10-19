import { loadInventoryFeed } from "@/lib/inventory-read-model";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "../../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { InventoryList } from "../_components/inventory-ui";

const titles: Record<string, string> = { items: "Bestand", inspections: "Prüfungen", defects: "Mängel" };

export default async function InventorySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "KUNDE") redirect("/dashboard");
  const { section } = await params;
  if (viewer.role === "PERSONAL" && section !== "defects") notFound();
  if (["medical-devices", "consumables", "bags", "oxygen", "movements"].includes(section)) redirect("/inventory/items");
  if (!titles[section]) notFound();
  return <AppShell title={titles[section]} subtitle="Material und Inventar verwalten."><InventoryList key={section} initialData={await loadInventoryFeed(section)} section={section} canManage={viewer.role === "ADMIN" || viewer.role === "VERWALTUNG"} /></AppShell>;
}
