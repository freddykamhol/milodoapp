import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { prowlKeys } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const rows = await db.query.prowlKeys.findMany({
    where: (t, { eq }) => eq(t.userId, viewer.id),
    orderBy: (t, { asc }) => [asc(t.label), asc(t.id)],
  });

  return NextResponse.json({
    ok: true,
    keys: rows.map((k) => ({ id: k.id, enabled: k.enabled, label: k.label, apiKey: k.apiKey })),
  });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const body = (await request.json()) as { label?: string; apiKey?: string };
  const label = String(body.label ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();
  if (!label || !apiKey) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const inserted = await db
    .insert(prowlKeys)
    .values({ userId: viewer.id, label, apiKey, enabled: true })
    .returning({ id: prowlKeys.id });

  return NextResponse.json({ ok: true, id: inserted.at(0)?.id ?? null });
}
