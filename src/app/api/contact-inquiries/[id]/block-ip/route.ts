import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ensureContactInquiriesTable } from "@/lib/contact-inquiries";
import { blockIp } from "@/lib/ip-blocklist";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function idFromUrl(request: Request): number | null {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idRaw = parts[parts.length - 2] ?? "";
  const id = Number(idRaw);
  return Number.isFinite(id) ? id : null;
}

function norm(v: unknown, max = 500) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  ensureContactInquiriesTable();
  const id = idFromUrl(request);
  if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const row = await db.query.contactInquiries.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!row || row.deletedAt) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!row.ip) return NextResponse.json({ ok: false, error: "no_ip" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  blockIp(row.ip, norm(body?.reason, 500) || `Blocked via contact inquiry #${id}`);

  return NextResponse.json({ ok: true });
}

