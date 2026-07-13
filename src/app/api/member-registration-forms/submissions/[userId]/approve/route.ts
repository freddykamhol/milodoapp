import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { memberRegistrationSubmissions, users } from "@/db/schema";
import { db } from "@/lib/db";
import { sendMemberRegistrationApprovedEmail } from "@/lib/member-registration-email";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { userId: rawUserId } = await params;
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 });

  const pending = await db.query.memberRegistrationSubmissions.findFirst({
    where: (table) => and(eq(table.userId, userId), eq(table.status, "PENDING")),
  });
  if (!pending) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.id, userId),
    columns: { email: true, username: true },
  });

  await db.transaction((tx) => {
    tx.update(users).set({ locked: false, updatedAt: new Date() }).where(eq(users.id, userId)).run();
    tx.update(memberRegistrationSubmissions)
      .set({
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: viewer.id,
        updatedAt: new Date(),
      })
      .where(eq(memberRegistrationSubmissions.id, pending.id))
      .run();
  });

  let emailSent = false;
  if (user?.email) {
    try {
      const result = await sendMemberRegistrationApprovedEmail({ to: user.email, username: user.username });
      emailSent = result.ok;
    } catch {
      emailSent = false;
    }
  }

  return NextResponse.json({ ok: true, emailSent });
}
