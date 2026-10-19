import { loadInventoryFeed } from "@/lib/inventory-read-model";
import { like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inventoryItems, inventoryMovements } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { assetDate, assetManager, AssetValidationError, integer, inventoryPrefixes, nextInventoryNumber } from "@/lib/asset-validation";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export async function GET(request: Request) {
 const viewer=await getViewer();if(!viewer)return json({error:"Nicht angemeldet"},401);if(viewer.role==="KUNDE")return json({error:"Keine Berechtigung"},403);
 const params=new URL(request.url).searchParams,nextCategory=params.get("nextNumber");
 if(nextCategory){if(!inventoryPrefixes[nextCategory])return json({error:"Ungültige Kategorie"},400);const rows=await db.select({number:inventoryItems.inventoryNumber}).from(inventoryItems).where(like(inventoryItems.inventoryNumber,inventoryPrefixes[nextCategory]+"-%"));return json({inventoryNumber:nextInventoryNumber(nextCategory,rows.map(row=>row.number))});}
 try{return json({...await loadInventoryFeed(params.get("view")??"items",params.get("category")),canManage:assetManager(viewer.role)});}
 catch(error){if(error instanceof AssetValidationError)return json({error:error.message},400);throw error;}
}

export async function POST(request: Request) {
  const viewer = await getViewer(); if (!viewer) return json({ error: "Nicht angemeldet" }, 401); if (!assetManager(viewer.role)) return json({ error: "Keine Berechtigung" }, 403);
  try {
    const body = await request.json().catch(() => null); if (!body || !String(body.name ?? "").trim()) throw new AssetValidationError("Bitte eine Bezeichnung angeben.");
    const category = body.category === "OXYGEN" ? "CONSUMABLE" : body.category;
    if (!inventoryPrefixes[category]) throw new AssetValidationError("Ungültige Kategorie.");
    const consumable = category === "CONSUMABLE", medical = category === "MEDICAL_DEVICE", oxygen = consumable && (body.materialType === "OXYGEN" || body.category === "OXYGEN");
    const quantity = consumable || category === "OTHER" ? integer(body.quantity, "Bestand", 0) : 1;
    const interval = medical || oxygen ? integer(body.inspectionIntervalDays, "Prüfintervall", 0) : 0;
    const last = medical || oxygen ? assetDate(body.lastInspectionAt, "Letzte Prüfung") : null;
    const next = medical || oxygen ? assetDate(body.nextInspectionAt, "Nächste Prüfung") ?? (last && interval ? new Date(last.getTime() + interval * 86400000) : null) : null;
    if (next && last && next < last) throw new AssetValidationError("Die nächste Prüfung darf nicht vor der letzten Prüfung liegen.");
    const capacity = oxygen ? integer(body.oxygenCapacityLiters, "Flascheninhalt") : null; if (oxygen && !capacity) throw new AssetValidationError("Bitte den Flascheninhalt angeben.");
    const percent = oxygen && body.oxygenContentPercent ? integer(body.oxygenContentPercent, "Sauerstoffgehalt") : null; if (percent !== null && percent > 100) throw new AssetValidationError("Der Sauerstoffgehalt darf höchstens 100 % betragen.");
    const result = db.transaction(tx => {
      let number = String(body.inventoryNumber ?? "").trim();
      if (body.autoInventoryNumber || !number) { const numbers = tx.select({ number: inventoryItems.inventoryNumber }).from(inventoryItems).where(like(inventoryItems.inventoryNumber, `${inventoryPrefixes[category]}-%`)).all(); number = nextInventoryNumber(category, numbers.map(row => row.number)); }
      const row = tx.insert(inventoryItems).values({
        name: String(body.name).trim(), category, inventoryNumber: number, quantity, minimumQuantity: consumable || category === "OTHER" ? integer(body.minimumQuantity, "Mindestbestand", 0) : 0, unit: consumable || category === "OTHER" ? String(body.unit || "Stück") : "Stück", location: String(body.location ?? "").trim(),
        manufacturer: String(body.manufacturer ?? ""), model: String(body.model ?? ""), serialNumber: medical ? String(body.serialNumber ?? "") : "", lotNumber: consumable ? String(body.lotNumber ?? "") : "", expiryAt: consumable ? assetDate(body.expiryAt, "Verfallsdatum") : null,
        inspectionIntervalDays: interval, lastInspectionAt: last, nextInspectionAt: next, medicalDeviceClass: medical ? String(body.medicalDeviceClass ?? "") : "", udi: medical ? String(body.udi ?? "") : "", commissionedAt: medical ? assetDate(body.commissionedAt, "Inbetriebnahme") : null,
        oxygenCapacityLiters: capacity, oxygenPressureBar: oxygen && body.oxygenPressureBar ? integer(body.oxygenPressureBar, "Prüfdruck") : null, oxygenContentPercent: percent, notes: String(body.notes ?? ""),
      }).returning({ id: inventoryItems.id, inventoryNumber: inventoryItems.inventoryNumber }).get();
      if (consumable && quantity) tx.insert(inventoryMovements).values({ itemId: row.id, movementType: "IN", quantityChange: quantity, quantityAfter: quantity, reason: "Anfangsbestand bei Erfassung", actorId: viewer.id }).run();
      return row;
    }, { behavior: "immediate" });
    return json(result, 201);
  } catch (error) { return json({ error: error instanceof AssetValidationError ? error.message : error instanceof Error && error.message.includes("UNIQUE") ? "Inventarnummer ist bereits vergeben." : "Artikel konnte nicht angelegt werden." }, 400); }
}
