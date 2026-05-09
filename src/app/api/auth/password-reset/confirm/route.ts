import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { consumePasswordResetToken } from "@/lib/password-reset";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown; newPassword?: unknown } | null;
  const token = String(body?.token ?? "").trim();
  const newPassword = String(body?.newPassword ?? "");

  if (!token || newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const row = await consumePasswordResetToken(token);
  if (!row) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });

  const passwordHash = hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, row.userId));

  return NextResponse.json({ ok: true });
}

