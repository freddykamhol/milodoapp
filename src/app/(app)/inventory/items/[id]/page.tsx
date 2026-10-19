import { loadInventoryDetail } from "@/lib/inventory-read-model";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "../../../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { InventoryDetail } from "../../_components/inventory-detail";

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "KUNDE" || viewer.role === "PERSONAL") notFound();
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId)) notFound();
  const data = await loadInventoryDetail(itemId, viewer.role);
  if (!data) notFound();
  return <AppShell title="Inventardetails" subtitle="Kategorieabhängige Verwaltung, Prüfung und Verlauf."><InventoryDetail key={id} initialData={data} id={id} canManage={viewer.role === "ADMIN" || viewer.role === "VERWALTUNG"} /></AppShell>;
}
