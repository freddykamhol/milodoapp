import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { sendCustomEmail } from "@/lib/custom-email";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const questionnaireId = Number(id);
  if (!Number.isFinite(questionnaireId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Partial<{ subject: string; message: string }>;
  const subject = String(body.subject ?? "").trim() || "MILODO – Nachricht";
  const message = String(body.message ?? "").trim();

  if (!message) return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ ok: false, error: "message_too_long" }, { status: 400 });

  let row: any = null;
  try {
    row = await db.query.personalQuestionnaires.findFirst({ where: (t, { eq }) => eq(t.id, questionnaireId) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("no such table")) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    throw e;
  }

  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const to = String(row.email || "").trim();
  if (!to) return NextResponse.json({ ok: false, error: "no_email" }, { status: 400 });

  try {
    const res = await sendCustomEmail({ to, subject, message });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    return NextResponse.json({ ok: false, error: "send_failed", message: msg }, { status: 500 });
  }
}

