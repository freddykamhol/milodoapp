import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { appointments } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

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
  const endAt = body.endAt === null || body.endAt === "" ? null : parseDate(body.endAt);
  const title = String(body.title ?? "").trim();
  const einsatzort = String(body.einsatzort ?? "").trim();
  const customerId = Number(body.customerId);
  const bereichRaw = String(body.bereich ?? "").trim();
  const dienstartRaw = body.dienstart === null || body.dienstart === "" ? "" : String(body.dienstart);
  const staffingRaw = String(body.staffingStatus ?? "").trim();
  const stateRaw = String(body.state ?? "").trim();

  if (!startAt || !title || !einsatzort || !Number.isFinite(customerId)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const bereich = asEnum(bereichRaw, ["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE"] as const, "RD_BOERSE");
  const dienstart = dienstartRaw
    ? asEnum(dienstartRaw, ["KTW", "NKTW", "RTW", "NEF", "ITW", "S_RTW", "SONSTIGES"] as const, "SONSTIGES")
    : null;
  const staffingStatus = asEnum(staffingRaw, ["BESETZT", "UNBESETZT", "UNTERBESETZT"] as const, "UNBESETZT");
  const state = asEnum(stateRaw, ["OPEN", "CLOSED", "CANCELLED"] as const, "OPEN");

  await db
    .update(appointments)
    .set({
      startAt,
      endAt: endAt ?? null,
      title,
      einsatzort,
      customerId,
      bereich,
      dienstart,
      staffingStatus,
      state,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId));

  return NextResponse.json({ ok: true });
}
