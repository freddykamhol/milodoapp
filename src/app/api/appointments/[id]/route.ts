import { NextResponse } from "next/server";
import { and,eq,sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointmentRequirements, appointments } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import {validateCourse,CourseError} from '@/lib/courses';
import {courseEnd} from '@/lib/course-types';

export const runtime = "nodejs";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  await db.delete(appointments).where(eq(appointments.id, appointmentId));
  return NextResponse.json({ ok: true });
}

function parseDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function asEnum<T extends string>(value: string, allowed: readonly T[], fallback: T) {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const body = (await request.json()) as Record<string, unknown>;
  const startAt = parseDate(body.startAt);
  let endAt = body.endAt === null || body.endAt === "" ? null : parseDate(body.endAt);
  const title = String(body.title ?? "").trim();
  const einsatzort = String(body.einsatzort ?? "").trim();
  const customerId = Number(body.customerId);
  const bereichRaw = String(body.bereich ?? "").trim();
  const dienstartRaw = body.dienstart === null || body.dienstart === "" ? "" : String(body.dienstart);
  const staffingRaw = String(body.staffingStatus ?? "").trim();
  const stateRaw = String(body.state ?? "").trim();
  const eventName = String(body.eventName ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const requirements = Array.isArray(body.requirements) ? body.requirements : [];
  const assets = Array.isArray(body.assets) ? body.assets : [];
  const visitors = body.visitors == null || body.visitors === "" ? null : Number(body.visitors);

  if (!startAt || !title || !einsatzort || !Number.isFinite(customerId)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const bereich = asEnum(bereichRaw, ["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE"] as const, "RD_BOERSE");
  const dienstart = dienstartRaw
    ? asEnum(dienstartRaw, ["KTW", "NKTW", "RTW", "NEF", "ITW", "S_RTW", "SONSTIGES"] as const, "SONSTIGES")
    : null;
  const staffingStatus = asEnum(staffingRaw, ["BESETZT", "UNBESETZT", "UNTERBESETZT"] as const, "UNBESETZT");
  const state = asEnum(stateRaw, ["OPEN", "CLOSED", "CANCELLED"] as const, "OPEN");

  const existing=await db.query.appointments.findFirst({where:eq(appointments.id,appointmentId)});
  if(!existing)return NextResponse.json({error:'Termin nicht gefunden.'},{status:404});
  let existingDetails: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(existing.detailsJson || "{}");
    if (parsed && typeof parsed === "object") existingDetails = parsed as Record<string, unknown>;
  } catch {
    existingDetails = {};
  }
  const detailsJson = JSON.stringify({
    ...existingDetails,
    serviceType: bereich,
    eventName,
    location: body.location && typeof body.location === "object" ? body.location : existingDetails.location,
    visitors: Number.isFinite(visitors) ? visitors : null,
    assets: assets.map((asset) => ({ item: String((asset as Record<string, unknown>).item ?? "").trim(), count: Math.max(1, Number((asset as Record<string, unknown>).count ?? 1) || 1) })).filter((asset) => asset.item),
    requirements: requirements.map((requirement) => ({ value: String((requirement as Record<string, unknown>).value ?? "").trim(), minCount: Math.max(1, Math.round(Number((requirement as Record<string, unknown>).minCount ?? 1) || 1)) })).filter((requirement) => requirement.value),
    notes,
  });
  const locationData = body.location && typeof body.location === "object" ? body.location as Record<string, unknown> : null;
  const locationName = String(locationData?.name ?? "").trim();
  const locationAddress = [locationData?.street, locationData?.houseNumber].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
  const locationCity = [locationData?.plz, locationData?.city].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
  const locationText = [locationName, [locationAddress, locationCity].filter(Boolean).join(", ")].filter(Boolean).join(" • ");
  if(existing.courseType&&bereich!=='ERSTE_HILFE')return NextResponse.json({error:'Ein Kurs kann nicht in einen anderen Bereich verschoben werden.'},{status:400});
  let courseValues:ReturnType<typeof validateCourse>|null=null;
  if(bereich==='ERSTE_HILFE'){
    try{courseValues=validateCourse(body.courseType??existing.courseType,body.participantLimit??existing.courseParticipantLimit);}catch(error){return NextResponse.json({error:error instanceof CourseError?error.message:'Ungültige Kursdaten.'},{status:400});}
    const {sqlite}=await import('@/lib/db');const count=(sqlite.prepare('select count(*) as n from course_participants where appointment_id=?').get(appointmentId) as {n:number}).n;
    if(count>courseValues.courseParticipantLimit)return NextResponse.json({error:'Die Teilnehmerzahl darf nicht kleiner als die bereits erfasste Anzahl sein.'},{status:409});
    endAt=courseEnd(startAt,courseValues.courseType);
  }else if(endAt&&endAt<=startAt)return NextResponse.json({error:'Das Ende muss nach dem Beginn liegen.'},{status:400});

  const changed=await db
    .update(appointments)
    .set({
      startAt,
      endAt: endAt ?? null,
      title,
      einsatzort: locationText || einsatzort,
      customerId,
      bereich,
      dienstart,
      eventName,
      notes,
      detailsJson,
      staffingStatus,
      state,
      updatedAt: new Date(),
      ...(courseValues??{}),
      ...(courseValues&&existing.courseRegistrationHash?{courseRegistrationExpiresAt:endAt}:{}),
    })
    .where(and(eq(appointments.id, appointmentId),courseValues?sql`(select count(*) from course_participants where appointment_id=${appointmentId})<=${courseValues.courseParticipantLimit}`:undefined)).returning({id:appointments.id});
  if(!changed.length)return NextResponse.json({error:'Die Teilnehmerzahl hat sich geändert. Bitte die Kursdaten neu laden.'},{status:409});

  await db.delete(appointmentRequirements).where(eq(appointmentRequirements.appointmentId, appointmentId));
  for (const requirement of requirements) {
    const row = requirement as Record<string, unknown>;
    const value = String(row.value ?? "").trim();
    if (!value) continue;
    await db.insert(appointmentRequirements).values({
      appointmentId,
      kind: bereich === "ERSTE_HILFE" ? "QUAL_AUSB" : "QUAL_RD",
      value,
      minCount: Math.max(1, Math.round(Number(row.minCount ?? 1) || 1)),
    });
  }

  return NextResponse.json({ ok: true });
}
