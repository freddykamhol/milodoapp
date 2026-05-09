import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();

  // Anti-Enumeration: immer ok zurückgeben
  if (!email) return NextResponse.json({ ok: true });

  const user = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, email), columns: { id: true } });
  if (!user?.id) return NextResponse.json({ ok: true });

  try {
    const { token } = await createPasswordResetToken(user.id, { ttlMinutes: 60 });
    const appUrl = String(process.env.APP_URL || "https://app.milodo-medical.de").replace(/\/+$/, "");
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail({ to: email, resetUrl });
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true });
}
