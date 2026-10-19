import { redirect } from "next/navigation";
import { AppShell } from "../../../_components/app-shell";
import { getViewer } from "@/lib/viewer";
import { InventoryForm } from "../../_components/inventory-form";
export default async function NewInventoryItemPage(){const viewer=await getViewer();if(!viewer)redirect("/login");if(viewer.role!=="ADMIN"&&viewer.role!=="VERWALTUNG")redirect("/inventory");return <AppShell title="Artikel anlegen" subtitle="Neues Material, Gerät oder eine Tasche erfassen."><InventoryForm/></AppShell>;}
