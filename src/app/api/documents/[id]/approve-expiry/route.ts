import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { documents } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const pending = await db.query.documents.findFirst({ where: (table, { eq }) => eq(table.id, documentId) });
  if (!pending || pending.expiryApprovalStatus !== "PENDING" || !pending.requestedExpiresAt) return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });
  const approved = await db.update(documents).set({
    expiresAt: pending.requestedExpiresAt,
    expiryApprovalStatus: "APPROVED",
    requestedExpiresAt: null,
    expiryReminderSentAt: null,
    expiredReminderSentAt: null,
    ownerExpiryReminderSentAt: null,
    ownerExpiredReminderSentAt: null,
    updatedAt: new Date(),
  }).where(and(eq(documents.id, documentId), eq(documents.expiryApprovalStatus, "PENDING"))).returning({ id: documents.id });
  if (!approved.length) return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
