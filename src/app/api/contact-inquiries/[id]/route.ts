import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { contactInquiries } from "@/db/schema";
import { ensureContactInquiriesTable } from "@/lib/contact-inquiries";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function idFromUrl(request: Request): number | null {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const id = Number(last);
  return Number.isFinite(id) ? id : null;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  ensureContactInquiriesTable();
  const id = idFromUrl(request);
  if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const row = await db.query.contactInquiries.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!row || row.deletedAt) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, item: row });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  ensureContactInquiriesTable();
  const id = idFromUrl(request);
  if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { read?: unknown; status?: unknown } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const update: Partial<typeof contactInquiries.$inferInsert> = { updatedAt: new Date() };
  if ("read" in body) update.readAt = body.read ? new Date() : null;
  if (typeof body.status === "string" && (body.status === "NEW" || body.status === "DONE")) update.status = body.status;

  await db.update(contactInquiries).set(update).where(eq(contactInquiries.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  ensureContactInquiriesTable();
  const id = idFromUrl(request);
  if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const now = new Date();
  await db
    .update(contactInquiries)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(contactInquiries.id, id));

  return NextResponse.json({ ok: true });
}

