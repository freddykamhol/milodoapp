import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { keyId?: number };
  const keyId = typeof body.keyId === "number" ? body.keyId : null;
  if (!keyId) return NextResponse.json({ ok: false, error: "missing_key" }, { status: 400 });

  const key = await db.query.prowlKeys.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, keyId), eq(t.userId, viewer.id), eq(t.enabled, true)),
  });
  if (!key?.apiKey?.trim()) return NextResponse.json({ ok: false, error: "missing_key" }, { status: 400 });

  const description = `✅ Milodo Testnachricht (${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date())})`;
  const params = new URLSearchParams({
    apikey: key.apiKey,
    application: "Milodo",
    event: "Test",
    description,
    priority: "0",
  });

  try {
    const res = await fetch("https://api.prowlapp.com/publicapi/add", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok || !text.includes("success")) {
      return NextResponse.json({ ok: false, error: "send_failed", message: text.slice(0, 500) }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "prowl send failed";
    return NextResponse.json({ ok: false, error: "send_failed", message: msg }, { status: 400 });
  }
}
