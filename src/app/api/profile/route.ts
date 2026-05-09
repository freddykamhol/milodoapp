import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const norm = (v: unknown) => String(v ?? "").trim();
  const normEmail = (v: unknown) => norm(v).toLowerCase();

  const next: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if ("firstName" in body) next.firstName = norm(body.firstName);
  if ("lastName" in body) next.lastName = norm(body.lastName);
  if ("email" in body) next.email = normEmail(body.email) || null;
  if ("telefon" in body) next.telefon = norm(body.telefon) || null;
  if ("strasse" in body) next.strasse = norm(body.strasse) || null;
  if ("hausnummer" in body) next.hausnummer = norm(body.hausnummer) || null;
  if ("plz" in body) next.plz = norm(body.plz) || null;
  if ("ort" in body) next.ort = norm(body.ort) || null;
  if ("ortErgaenzung" in body) next.ortErgaenzung = norm(body.ortErgaenzung);

  const asBool = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
  next.publicFirstName = true;
  next.publicLastName = true;
  if ("publicGeb" in body) next.publicGeb = asBool(body.publicGeb);
  if ("publicQualifications" in body) next.publicQualifications = asBool(body.publicQualifications);
  if ("publicAddress" in body) next.publicAddress = asBool(body.publicAddress);
  if ("publicContact" in body) next.publicContact = asBool(body.publicContact);

  if ("geb" in body) {
    const iso = norm(body.geb);
    if (!iso) next.geb = null;
    else {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ ok: false, error: "invalid_geb" }, { status: 400 });
      next.geb = d;
    }
  }

  await db.update(users).set(next).where(eq(users.id, viewer.id));
  return NextResponse.json({ ok: true });
}
