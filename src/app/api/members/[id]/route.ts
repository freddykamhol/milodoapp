import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { customers, users } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

type Bereich = "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  if (userId === viewer.id) return NextResponse.json({ ok: false, error: "self" }, { status: 400 });

  await db.delete(users).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const target = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  if (!target) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const norm = (v: unknown) => String(v ?? "").trim();
  const normEmail = (v: unknown) => norm(v).toLowerCase();
  const normCents = (v: unknown) => {
    if (v === null) return null;
    if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
    return Math.max(0, Math.round(v));
  };

  const nextUser: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };

  if ("firstName" in body) nextUser.firstName = norm(body.firstName);
  if ("lastName" in body) nextUser.lastName = norm(body.lastName);
  if ("email" in body) nextUser.email = normEmail(body.email) || null;
  if ("telefon" in body) nextUser.telefon = norm(body.telefon) || null;
  if ("strasse" in body) nextUser.strasse = norm(body.strasse) || null;
  if ("hausnummer" in body) nextUser.hausnummer = norm(body.hausnummer) || null;
  if ("plz" in body) nextUser.plz = norm(body.plz) || null;
  if ("ort" in body) nextUser.ort = norm(body.ort) || null;
  if ("ortErgaenzung" in body) nextUser.ortErgaenzung = norm(body.ortErgaenzung);
  if ("hourlyRateQualRdCents" in body) {
    const cents = normCents(body.hourlyRateQualRdCents);
    if (cents === undefined) return NextResponse.json({ ok: false, error: "invalid_hourly_rate" }, { status: 400 });
    nextUser.hourlyRateQualRdCents = cents;
  }
  if ("hourlyRateQualAusbCents" in body) {
    const cents = normCents(body.hourlyRateQualAusbCents);
    if (cents === undefined) return NextResponse.json({ ok: false, error: "invalid_hourly_rate" }, { status: 400 });
    nextUser.hourlyRateQualAusbCents = cents;
  }

  if ("geb" in body) {
    const iso = norm(body.geb);
    if (!iso) nextUser.geb = null;
    else {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ ok: false, error: "invalid_geb" }, { status: 400 });
      nextUser.geb = d;
    }
  }

  await db.update(users).set(nextUser).where(eq(users.id, userId));

  if (target.role === "KUNDE") {
    const cust = await db.query.customers.findFirst({ where: (t, { eq }) => eq(t.accountUserId, userId) });
    if (cust) {
      const nextCust: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };
      if ("firma" in body) nextCust.name = norm(body.firma) || cust.name;
      if ("ansprechpartner" in body) nextCust.contactName = norm(body.ansprechpartner);
      if ("customerStreet" in body) nextCust.street = norm(body.customerStreet);
      if ("customerHouseNumber" in body) nextCust.houseNumber = norm(body.customerHouseNumber);
      if ("customerPlz" in body) nextCust.plz = norm(body.customerPlz);
      if ("customerCity" in body) nextCust.city = norm(body.customerCity);
      if ("hauptbereich" in body) {
        const mb = norm(body.hauptbereich);
        if (["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE"].includes(mb)) nextCust.mainBereich = mb as Bereich;
      }
      await db.update(customers).set(nextCust).where(eq(customers.id, cust.id));
    }
  }

  return NextResponse.json({ ok: true });
}
