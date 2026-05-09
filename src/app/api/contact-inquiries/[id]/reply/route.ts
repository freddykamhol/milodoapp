import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ensureContactInquiriesTable } from "@/lib/contact-inquiries";
import { getViewer } from "@/lib/viewer";
import { sendCustomEmail } from "@/lib/custom-email";

export const runtime = "nodejs";

function idFromUrl(request: Request): number | null {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idRaw = parts[parts.length - 2] ?? "";
  const id = Number(idRaw);
  return Number.isFinite(id) ? id : null;
}

function norm(v: unknown, max = 8000) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(request: Request) {
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
  if (!row.email) return NextResponse.json({ ok: false, error: "no_email" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { subject?: unknown; message?: unknown } | null;
  const subject = norm(body?.subject, 180);
  const message = norm(body?.message, 8000);
  if (!subject || !message) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  const quoted = [
    "",
    "—",
    `Originalanfrage #${row.id}`,
    `Bereich: ${row.mode}`,
    `Name: ${row.name}`,
    `Firma: ${row.company || "-"}`,
    `E‑Mail: ${row.email}`,
    `Telefon: ${row.phone || "-"}`,
    `Quelle: ${row.sourceUrl || "-"}`,
    "",
    "Nachricht:",
    row.message || "-",
  ].join("\n");

  const res = await sendCustomEmail({
    to: row.email,
    subject,
    message: `${message}\n${quoted}`.trim(),
  });

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

