import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { AppShell } from "../../../_components/app-shell";
import { DefectCreateForm } from "../../../_components/defects";
import { db } from "@/lib/db";
import { inventoryItems } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
export default async function NewInventoryDefect({searchParams}:{searchParams:Promise<{itemId?:string}>}){const viewer=await getViewer();if(!viewer)redirect("/login");if(viewer.role==="KUNDE")redirect("/dashboard");const items=await db.select().from(inventoryItems).where(and(eq(inventoryItems.category,"MEDICAL_DEVICE"),ne(inventoryItems.status,"RETIRED"))).orderBy(inventoryItems.name);const {itemId}=await searchParams;return <AppShell title="Mangel erfassen" subtitle="Mangel dokumentieren und zur Bearbeitung melden."><DefectCreateForm domain="inventory" subjects={items.map(item=>({id:item.id,label:`${item.name}${item.inventoryNumber?` - ${item.inventoryNumber}`:""}`}))} initialSubject={itemId}/></AppShell>;}
