import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicleDefects } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import {removeDefectImage} from "@/lib/defect-image-actions";

const statuses = ["ERSTELLT", "IN_BEARBEITUNG", "BEHOBEN"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const defectId = Number((await params).id);
  const body = await request.json().catch(() => null) as { status?: unknown; action?:unknown;index?:unknown;expected?:unknown } | null;
  if(body?.action==='removeImage')return removeDefectImage('vehicle',defectId,body.index,body.expected);
  if (!Number.isInteger(defectId) || !statuses.includes(body?.status as (typeof statuses)[number])) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  const updated = await db.update(vehicleDefects).set({ status: body!.status as (typeof statuses)[number], updatedAt: new Date() }).where(eq(vehicleDefects.id, defectId)).returning({ id: vehicleDefects.id });
  if (!updated.length) return NextResponse.json({ error: "Mangel nicht gefunden" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
