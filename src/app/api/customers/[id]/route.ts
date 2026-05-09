import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { customers } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function canManageCustomers(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!canManageCustomers(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const norm = (v: unknown) => String(v ?? "").trim();

  const name = norm(body.name);
  if (!name) return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });

  const mb = norm(body.mainBereich);
  const mainBereich = (["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE"].includes(mb) ? mb : "RD_BOERSE") as
    | "RD_BOERSE"
    | "SANITATSDIENST"
    | "ERSTE_HILFE";

  await db
    .update(customers)
    .set({
      name,
      mainBereich,
      contactName: norm(body.contactName),
      street: norm(body.street),
      houseNumber: norm(body.houseNumber),
      plz: norm(body.plz),
      city: norm(body.city),
      email: norm(body.email),
      phone: norm(body.phone),
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!canManageCustomers(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  try {
    await db.delete(customers).where(eq(customers.id, customerId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 409 });
  }
}
