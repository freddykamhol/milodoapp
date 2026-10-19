import { loadFleetFeed } from "@/lib/fleet-read-model";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicleDefects, vehicleMaintenances, vehicleTrips, vehicles } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { assetDate, AssetValidationError, integer } from "@/lib/asset-validation";
import { defectImages, vehicleDefectCategories } from "@/lib/defects";
import { notifyResponsibility } from "@/lib/responsibility-notifications";

const canManage = (role: string) => role === "ADMIN" || role === "VERWALTUNG";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET(request: Request) {
 const viewer=await getViewer();if(!viewer)return json({error:"Nicht angemeldet"},401);if(viewer.role==="KUNDE")return json({error:"Keine Berechtigung"},403);
 const view=new URL(request.url).searchParams.get("view")??"vehicles";
 if(viewer.role==="PERSONAL"&&view!=="defects"&&view!=="trips")return json({error:"Keine Berechtigung"},403);
 return json(await loadFleetFeed(viewer.role,view));
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Nicht angemeldet" }, 401);
  if (viewer.role === "KUNDE") return json({ error: "Keine Berechtigung" }, 403);
  try {
    const body = await request.json().catch(() => null);
    if (!body) throw new AssetValidationError("Ungültige Eingaben.");
    if (body.kind === "vehicle") {
      if (!canManage(viewer.role)) return json({ error: "Keine Berechtigung" }, 403);
      const plate = String(body.licensePlate ?? "").trim().toLocaleUpperCase("de-DE"), mileage = integer(body.initialMileage, "Kilometerstand");
      if (!plate || plate.length > 20 || !["PKW", "MTW", "KTW", "RTW", "S-KTW-S-RTW", "ITW", "NEF", "LKW", "SONSTIGE"].includes(body.type)) throw new AssetValidationError("Kennzeichen und gültiger Fahrzeugtyp sind erforderlich.");
      const [created] = await db.insert(vehicles).values({ licensePlate: plate, type: body.type, initialMileage: mileage, mileage, location: String(body.location ?? ""), tuvLastAt: assetDate(body.tuvLastAt, "Letzte TÜV-Prüfung", true), notes: String(body.notes ?? "") }).returning({ id: vehicles.id });
      return json({ id: created.id }, 201);
    }
    const vehicleId = integer(body.vehicleId, "Fahrzeugnummer");
    const vehicle = await db.query.vehicles.findFirst({ where: (t, { eq }) => eq(t.id, vehicleId) });
    if (!vehicle) return json({ error: "Fahrzeug nicht gefunden" }, 404);
    if (body.kind === "defect") {
      const title = String(body.title ?? "").trim();
      if (!title || !vehicleDefectCategories[body.category]) throw new AssetValidationError("Mangeltitel und gültige Kategorie sind erforderlich.");
      const images = defectImages(body.imageUrls); if (images.some(image => image.length > 3 * 1024 * 1024)) throw new AssetValidationError("Bilder dürfen maximal 2 MB groß sein.");
      const [created] = await db.insert(vehicleDefects).values({ vehicleId, title, description: String(body.description ?? ""), category: body.category, mileage: integer(body.mileage, "Kilometerstand", vehicle.mileage), imageUrls: JSON.stringify(images), reportedById: viewer.id }).returning({ id: vehicleDefects.id });
      void notifyResponsibility("VEHICLE", { title: "Neuer Fahrzeugmangel", body: `${vehicle.licensePlate}: ${title}`, href: `/vehicles/${vehicleId}` }).catch(() => null);
      return json({ id: created.id }, 201);
    }
    if (body.kind === "trip") {
      if (!vehicle.isActive) return json({ error: "Fahrzeug ist außer Dienst" }, 409);
      const title = String(body.title ?? "").trim(), kmStart = integer(body.kmStart, "KM Start"), kmEnd = integer(body.kmEnd, "KM Ende"), startAt = assetDate(body.startAt, "Fahrtbeginn", true)!, endAt = assetDate(body.endAt, "Fahrtende", true)!;
      if (!title || kmEnd < kmStart || endAt < startAt) throw new AssetValidationError("Titel, Kilometerstände und Zeitraum müssen gültig sein.");
      const appointmentId = body.appointmentId ? integer(body.appointmentId, "Dienstnummer") : null;
      if (appointmentId) { const service = await db.query.appointments.findFirst({ where: (t, { eq }) => eq(t.id, appointmentId) }); if (!service || service.state === "CANCELLED") throw new AssetValidationError("Der zugeordnete Dienst ist nicht verfügbar."); }
      const created = db.transaction(tx => {
        const current = tx.select().from(vehicles).where(eq(vehicles.id, vehicleId)).get();
        if (!current?.isActive || current.mileage !== kmStart) throw new AssetValidationError("Der Kilometerstand wurde geändert. Bitte das Formular neu laden.");
        if (tx.select({ id: vehicleTrips.id }).from(vehicleTrips).where(eq(vehicleTrips.title, title)).get()) throw new AssetValidationError("Dieser Fahrttitel ist bereits vergeben.");
        const trip = tx.insert(vehicleTrips).values({ vehicleId, title, kmStart, kmEnd, startAt, endAt, appointmentId, createdById: viewer.id }).returning({ id: vehicleTrips.id }).get();
        tx.update(vehicles).set({ mileage: kmEnd, updatedAt: new Date() }).where(eq(vehicles.id, vehicleId)).run();
        return trip;
      }, { behavior: "immediate" });
      return json({ id: created.id }, 201);
    }
    if (body.kind === "maintenance") {
      if (!canManage(viewer.role)) return json({ error: "Keine Berechtigung" }, 403);
      const title = String(body.title ?? "").trim(), lastAt = assetDate(body.lastAt, "Letzte Wartung", true)!, intervalDays = integer(body.intervalDays, "Wartungsintervall");
      if (!title || !intervalDays) throw new AssetValidationError("Titel und Wartungsintervall sind erforderlich.");
      const [created] = await db.insert(vehicleMaintenances).values({ vehicleId, title, lastAt, intervalDays, nextAt: new Date(lastAt.getTime() + intervalDays * 86400000) }).returning({ id: vehicleMaintenances.id });
      return json({ id: created.id }, 201);
    }
    throw new AssetValidationError("Unbekannte Aktion.");
  } catch (error) { return json({ error: error instanceof AssetValidationError ? error.message : error instanceof Error && error.message.includes("UNIQUE") ? "Das Kennzeichen ist bereits vergeben." : "Speichern fehlgeschlagen." }, 400); }
}
