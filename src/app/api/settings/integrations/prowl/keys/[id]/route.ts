import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { prowlKeys } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const { id } = await params;
  const keyId = Number(id);
  if (!Number.isFinite(keyId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const body = (await request.json()) as Partial<{ enabled: boolean; label: string; apiKey: string }>;
  const update: Partial<typeof prowlKeys.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.label === "string") update.label = body.label.trim();
  if (typeof body.apiKey === "string") update.apiKey = body.apiKey.trim();

  await db.update(prowlKeys).set(update).where(and(eq(prowlKeys.id, keyId), eq(prowlKeys.userId, viewer.id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const { id } = await params;
  const keyId = Number(id);
  if (!Number.isFinite(keyId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  await db.delete(prowlKeys).where(and(eq(prowlKeys.id, keyId), eq(prowlKeys.userId, viewer.id)));
  return NextResponse.json({ ok: true });
}
