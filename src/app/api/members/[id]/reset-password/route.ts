import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  if (!target) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const email = String(target.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });

  try {
    const { token } = await createPasswordResetToken(userId, { ttlMinutes: 60 });
    const appUrl = String(process.env.APP_URL || "https://app.milodo-medical.de").replace(/\/+$/, "");
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const mail = await sendPasswordResetEmail({ to: email, resetUrl });
    if (!mail.ok) return NextResponse.json({ ok: false, error: mail.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
