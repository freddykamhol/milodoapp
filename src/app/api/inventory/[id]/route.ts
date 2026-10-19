import { loadInventoryDetail } from "@/lib/inventory-read-model";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inventoryDefects, inventoryInspections, inventoryItems, inventoryMovements } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { assetDate, assetManager, AssetValidationError, integer } from "@/lib/asset-validation";
import { defectImages } from "@/lib/defects";
import { notifyResponsibility } from "@/lib/responsibility-notifications";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
type Context = { params: Promise<{ id: string }> };

export async function GET(_request:Request,context:Context){
 const viewer=await getViewer();if(!viewer)return json({error:"Nicht angemeldet"},401);if(viewer.role==="KUNDE")return json({error:"Keine Berechtigung"},403);
 const itemId=Number((await context.params).id);if(!Number.isSafeInteger(itemId))return json({error:"Ungültige Artikelnummer"},400);
 const data=await loadInventoryDetail(itemId,viewer.role);return data?json(data):json({error:"Artikel nicht gefunden"},404);
}

export async function PATCH(request: Request, context: Context) {
  const viewer = await getViewer(); if (!viewer) return json({ error: "Nicht angemeldet" }, 401); if (!assetManager(viewer.role)) return json({ error: "Keine Berechtigung" }, 403);
  try {
    const itemId = integer((await context.params).id, "Artikelnummer"), body = await request.json().catch(() => null); if (!body) throw new AssetValidationError("Ungültige Eingaben.");
    const existing = await db.query.inventoryItems.findFirst({ where: (t, { eq }) => eq(t.id, itemId) }); if (!existing) return json({ error: "Artikel nicht gefunden" }, 404);
    const patch: Partial<typeof inventoryItems.$inferInsert> = { updatedAt: new Date() };
    if (body.action === "retire") patch.status = "RETIRED";
    else if (body.action === "status") { if (!["ACTIVE", "OUT_OF_SERVICE"].includes(body.status)) throw new AssetValidationError("Ungültiger Status."); patch.status = body.status; }
    else if (body.action === "location") { if (!["MEDICAL_DEVICE", "BAG"].includes(existing.category)) throw new AssetValidationError("Standortwechsel ist für diese Kategorie nicht verfügbar."); patch.location = String(body.location ?? "").trim(); if (!patch.location) throw new AssetValidationError("Standort fehlt."); }
    else if (body.action) throw new AssetValidationError("Unbekannte Aktion.");
    else {
      const strings = ["inventoryNumber", "name", "unit", "location", "manufacturer", "model", "serialNumber", "lotNumber", "medicalDeviceClass", "udi", "notes"] as const;
      for (const key of strings) if (key in body) patch[key] = String(body[key] ?? "").trim();
      if ("name" in patch && !patch.name) throw new AssetValidationError("Bezeichnung fehlt.");
      for (const key of ["minimumQuantity", "inspectionIntervalDays", "oxygenCapacityLiters", "oxygenPressureBar", "oxygenContentPercent"] as const) if (key in body) patch[key] = integer(body[key], key);
      for (const key of ["expiryAt", "lastInspectionAt", "nextInspectionAt", "commissionedAt"] as const) if (key in body) patch[key] = assetDate(body[key], key);
      if (Object.keys(patch).length === 1) throw new AssetValidationError("Keine Änderungen angegeben.");
    }
    await db.update(inventoryItems).set(patch).where(eq(inventoryItems.id, itemId)); return json({ ok: true });
  } catch (error) { return json({ error: error instanceof AssetValidationError ? error.message : error instanceof Error && error.message.includes("UNIQUE") ? "Inventarnummer ist bereits vergeben." : "Speichern fehlgeschlagen." }, 400); }
}

export async function POST(request: Request, context: Context) {
  const viewer = await getViewer(); if (!viewer) return json({ error: "Nicht angemeldet" }, 401); if (viewer.role === "KUNDE") return json({ error: "Keine Berechtigung" }, 403);
  try {
    const itemId = integer((await context.params).id, "Artikelnummer"), body = await request.json().catch(() => null); if (!body) throw new AssetValidationError("Ungültige Eingaben.");
    const item = await db.query.inventoryItems.findFirst({ where: (t, { eq }) => eq(t.id, itemId) }); if (!item) return json({ error: "Artikel nicht gefunden" }, 404);
    if (body.action === "movement") {
      if (!["CONSUMABLE", "OXYGEN"].includes(item.category)) throw new AssetValidationError("Bestandsbewegungen sind nur für Verbrauchsmaterial möglich.");
      const type = body.type as "IN" | "OUT" | "ADJUST"; if (!["IN", "OUT", "ADJUST"].includes(type)) throw new AssetValidationError("Ungültige Buchungsart."); if (type !== "OUT" && !assetManager(viewer.role)) return json({ error: "Keine Berechtigung" }, 403);
      const amount = integer(body.quantity, "Menge"), reason = String(body.reason ?? "").trim(); if ((!amount && type !== "ADJUST") || !reason) throw new AssetValidationError("Menge und Grund sind erforderlich.");
      const quantity = db.transaction(tx => {
        const current = tx.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).get(); if (!current || current.status !== "ACTIVE") throw new AssetValidationError("Artikel ist nicht aktiv.");
        const change = type === "IN" ? amount : type === "OUT" ? -amount : amount - current.quantity, after = current.quantity + change; if (after < 0) throw new AssetValidationError("Der Bestand kann nicht negativ werden.");
        tx.update(inventoryItems).set({ quantity: after, updatedAt: new Date() }).where(eq(inventoryItems.id, itemId)).run();
        tx.insert(inventoryMovements).values({ itemId, movementType: type, quantityChange: change, quantityAfter: after, reason, reference: String(body.reference ?? ""), actorId: viewer.id }).run(); return after;
      }, { behavior: "immediate" });
      return json({ quantity });
    }
    if (body.action === "inspection") {
      if (!assetManager(viewer.role)) return json({ error: "Keine Berechtigung" }, 403); if (item.category !== "MEDICAL_DEVICE" || item.status === "RETIRED") throw new AssetValidationError("Für diesen Artikel können keine Prüfungen dokumentiert werden.");
      if (!["PASSED", "FAILED", "REPAIR_REQUIRED"].includes(body.result)) throw new AssetValidationError("Ungültiges Prüfergebnis.");
      const performedAt = assetDate(body.performedAt, "Prüfdatum", true)!;
      const nextDueAt = assetDate(body.nextDueAt, "Nächste Prüfung") ?? (item.inspectionIntervalDays ? new Date(performedAt.getTime() + item.inspectionIntervalDays * 86400000) : null);
      if (nextDueAt && nextDueAt < performedAt) throw new AssetValidationError("Die nächste Prüfung darf nicht vor dem Prüfdatum liegen.");
      db.transaction(tx => { tx.insert(inventoryInspections).values({ itemId, result: body.result, performedAt, nextDueAt, notes: String(body.notes ?? ""), performedById: viewer.id }).run(); tx.update(inventoryItems).set({ lastInspectionAt: performedAt, nextInspectionAt: nextDueAt, status: body.result === "PASSED" ? item.status : "OUT_OF_SERVICE", updatedAt: new Date() }).where(eq(inventoryItems.id, itemId)).run(); });
      return json({ ok: true });
    }
    if (body.action === "defect") {
      if (item.category !== "MEDICAL_DEVICE" || item.status === "RETIRED") throw new AssetValidationError("Für diesen Artikel können keine Mängel erfasst werden.");
      const title = String(body.title ?? "").trim(); if (!title) throw new AssetValidationError("Bitte einen Mangeltitel angeben.");
      const images = defectImages(body.imageUrls); if (images.some(image => image.length > 3 * 1024 * 1024)) throw new AssetValidationError("Bilder dürfen maximal 2 MB groß sein.");
      const [created] = await db.insert(inventoryDefects).values({ itemId, title, description: String(body.description ?? ""), imageUrls: JSON.stringify(images), reportedById: viewer.id }).returning({ id: inventoryDefects.id }); void notifyResponsibility("MATERIAL", { title: "Neuer Materialmangel", body: `${item.name}: ${title}`, href: `/inventory/items/${itemId}` }).catch(() => null); return json({ id: created.id }, 201);
    }
    throw new AssetValidationError("Unbekannte Aktion.");
  } catch (error) { return json({ error: error instanceof AssetValidationError ? error.message : "Aktion konnte nicht gespeichert werden." }, 400); }
}
