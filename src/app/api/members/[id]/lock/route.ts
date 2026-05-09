import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  if (userId === viewer.id) return NextResponse.json({ ok: false, error: "self" }, { status: 400 });

  const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  if (!target) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const nextLocked = !target.locked;
  await db.update(users).set({ locked: nextLocked, updatedAt: new Date() }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true, locked: nextLocked });
}
