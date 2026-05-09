import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

type DetailsJson = {
  location?: { street?: string; houseNumber?: string; plz?: string; city?: string };
};

function safeParseDetails(raw: string): DetailsJson {
  try {
    const obj = JSON.parse(raw || "{}") as unknown;
    return obj && typeof obj === "object" ? (obj as DetailsJson) : {};
  } catch {
    return {};
  }
}

function buildAddressString(detailsJson: string) {
  const details = safeParseDetails(detailsJson);
  const location = details.location ?? {};
  const addr = [location.street, location.houseNumber].filter(Boolean).join(" ").trim();
  const city = [location.plz, location.city].filter(Boolean).join(" ").trim();
  return [addr, city].filter(Boolean).join(", ").trim();
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const row = await db.query.appointments.findFirst({
    where: (t, { eq }) => eq(t.id, appointmentId),
    columns: { id: true, einsatzort: true, detailsJson: true },
  });
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const destination = buildAddressString(row.detailsJson) || row.einsatzort;
  return NextResponse.json({ ok: true, destination });
}
