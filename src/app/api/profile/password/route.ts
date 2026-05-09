import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { newPassword?: unknown } | null;
  const newPassword = String(body?.newPassword ?? "");
  if (newPassword.length < 8) return NextResponse.json({ ok: false, error: "too_short" }, { status: 400 });

  const passwordHash = hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, viewer.id));
  return NextResponse.json({ ok: true });
}
