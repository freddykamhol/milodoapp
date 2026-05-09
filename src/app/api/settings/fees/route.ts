import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { feeRates } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

type Kind = "QUAL_RD" | "QUAL_AUSB";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const rows = await db.query.feeRates.findMany({
    orderBy: (t, { asc }) => [asc(t.kind), asc(t.value)],
  });

  return NextResponse.json({
    ok: true,
    rates: rows.map((r) => ({
      kind: r.kind,
      value: r.value,
      hourlyRateCents: r.hourlyRateCents ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    kind?: Kind;
    value?: string;
    hourlyRateCents?: number | null;
  };

  const kind = body.kind;
  const value = String(body.value ?? "").trim();
  if (kind !== "QUAL_RD" && kind !== "QUAL_AUSB") {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }
  if (!value) return NextResponse.json({ ok: false, error: "invalid_value" }, { status: 400 });

  const cents =
    body.hourlyRateCents === null
      ? null
      : typeof body.hourlyRateCents === "number" && Number.isFinite(body.hourlyRateCents)
        ? Math.max(0, Math.round(body.hourlyRateCents))
        : null;

  await db
    .insert(feeRates)
    .values({ kind, value, hourlyRateCents: cents })
    .onConflictDoUpdate({
      target: [feeRates.kind, feeRates.value],
      set: { hourlyRateCents: cents, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
