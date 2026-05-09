import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { customers, users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { buildUserRemoteDir, isSftpEnabled, withSftp } from "@/lib/sftp";
import { getViewer } from "@/lib/viewer";
import { sendWelcomeEmail } from "@/lib/welcome-email";

export const runtime = "nodejs";

type InternPayload = {
  kind: "INTERN";
  role?: "ADMIN" | "VERWALTUNG" | "PERSONAL";
  qualRD?: "SAN" | "RH" | "RS" | "RA" | "NFS" | null;
  qualAusb?: "AUSBILDER" | null;
  einsatzort?: "AUSBILDUNG" | "RD" | "BEIDE" | null;
  firstName: string;
  lastName: string;
  geb?: string | null;
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  ortErgaenzung?: string | null;
  email?: string | null;
  telefon?: string | null;
};

type KundePayload = {
  kind: "KUNDE";
  firma: string;
  ansprechpartner?: string | null;
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  hauptbereich: "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";
  email?: string | null;
  telefon?: string | null;
};

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Partial<InternPayload | KundePayload>;

  const kind = body.kind;
  if (kind !== "INTERN" && kind !== "KUNDE") {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }

  function normBasic(v: unknown) {
    return String(v ?? "").trim();
  }
  function normEmail(v: unknown) {
    const s = normBasic(v).toLowerCase();
    return s || "";
  }
  function deSlug(s: string) {
    return s
      .toLowerCase()
      .replaceAll("ä", "a")
      .replaceAll("ö", "o")
      .replaceAll("ü", "u")
      .replaceAll("ß", "ss")
      .replaceAll(/[^a-z0-9]/g, "");
  }

  async function usernameExists(username: string) {
    const row = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.username, username), columns: { id: true } });
    return Boolean(row?.id);
  }

  async function buildInternUsername(firstName: string, lastName: string) {
    const fn = deSlug(firstName);
    const ln = deSlug(lastName);
    if (!fn || !ln) return "";

    for (let i = 1; i <= Math.min(fn.length, 4); i++) {
      const candidate = `${fn.slice(0, i)}${ln}`;
      if (!(await usernameExists(candidate))) return candidate;
    }
    for (let n = 2; n < 100; n++) {
      const candidate = `${fn.slice(0, Math.min(fn.length, 4))}${ln}${n}`;
      if (!(await usernameExists(candidate))) return candidate;
    }
    return "";
  }

  async function buildCustomerUsername() {
    const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
    const prefix = yy;
    const rows = await db
      .select({ username: users.username })
      .from(users)
      .where(and(eq(users.role, "KUNDE"), sql`${users.username} like ${prefix + "%"}`))
      .limit(5000);

    let maxSeq = 0;
    for (const r of rows) {
      const u = String(r.username || "");
      if (u.length !== 6 || !u.startsWith(prefix)) continue;
      const tail = Number(u.slice(2));
      if (Number.isFinite(tail)) maxSeq = Math.max(maxSeq, tail);
    }

    const next = maxSeq + 1;
    return `${yy}${String(next).padStart(4, "0")}`;
  }

  const randomSecret = crypto.randomBytes(24).toString("base64url");
  const passwordHash = hashPassword(randomSecret);

  let createdUserId: number | null = null;
  let createdUsername = "";
  let targetEmail = "";

  if (kind === "INTERN") {
    const intern = body as Partial<InternPayload>;
    const firstName = normBasic(intern.firstName);
    const lastName = normBasic(intern.lastName);
    const email = normEmail(intern.email);
    const telefon = normBasic(intern.telefon);
    if (!firstName || !lastName) return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
    if (!email) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });

    const username = await buildInternUsername(firstName, lastName);
    if (!username) return NextResponse.json({ ok: false, error: "username_failed" }, { status: 500 });

    const gebIso = normBasic(intern.geb);
    const geb = gebIso ? new Date(gebIso) : null;
    if (gebIso && Number.isNaN(geb!.getTime())) return NextResponse.json({ ok: false, error: "invalid_geb" }, { status: 400 });

    const inserted = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        role: intern.role === "ADMIN" || intern.role === "VERWALTUNG" ? intern.role : "PERSONAL",
        firstName,
        lastName,
        qualRD:
          intern.qualRD && ["SAN", "RH", "RS", "RA", "NFS"].includes(intern.qualRD)
            ? intern.qualRD
            : null,
        qualAusb: intern.qualAusb === "AUSBILDER" ? "AUSBILDER" : null,
        einsatzort:
          intern.einsatzort && ["AUSBILDUNG", "RD", "BEIDE"].includes(intern.einsatzort)
            ? intern.einsatzort
            : null,
        geb: geb ?? undefined,
        strasse: normBasic(intern.strasse) || null,
        hausnummer: normBasic(intern.hausnummer) || null,
        plz: normBasic(intern.plz) || null,
        ort: normBasic(intern.ort) || null,
        ortErgaenzung: normBasic(intern.ortErgaenzung) || "",
        email,
        telefon: telefon || null,
      })
      .returning({ id: users.id, username: users.username });

    createdUserId = inserted.at(0)?.id ?? null;
    createdUsername = inserted.at(0)?.username ?? username;
    targetEmail = email;
  } else {
    const kunde = body as Partial<KundePayload>;
    const firma = normBasic(kunde.firma);
    const hauptbereich = normBasic(kunde.hauptbereich);
    if (!firma) return NextResponse.json({ ok: false, error: "invalid_firma" }, { status: 400 });
    if (!["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE"].includes(hauptbereich)) {
      return NextResponse.json({ ok: false, error: "invalid_bereich" }, { status: 400 });
    }

    const email = normEmail(kunde.email);
    const telefon = normBasic(kunde.telefon);
    if (!email) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });

    const username = await buildCustomerUsername();
    if (!username) return NextResponse.json({ ok: false, error: "username_failed" }, { status: 500 });

    const inserted = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        role: "KUNDE",
        email,
        telefon: telefon || null,
      })
      .returning({ id: users.id, username: users.username });

    createdUserId = inserted.at(0)?.id ?? null;
    createdUsername = inserted.at(0)?.username ?? username;
    targetEmail = email;

    if (createdUserId) {
      await db.insert(customers).values({
        name: firma,
        contactName: normBasic(kunde.ansprechpartner) || "",
        street: normBasic(kunde.strasse) || "",
        houseNumber: normBasic(kunde.hausnummer) || "",
        plz: normBasic(kunde.plz) || "",
        city: normBasic(kunde.ort) || "",
        email,
        phone: telefon || "",
        mainBereich: hauptbereich as KundePayload["hauptbereich"],
        accountUserId: createdUserId,
      });
    }
  }

  if (!createdUserId || !createdUsername) return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });

  if (await isSftpEnabled()) {
    try {
      await withSftp(async (client, basePath) => {
        await client.mkdir(buildUserRemoteDir(basePath, createdUsername), true);
        return true;
      });
    } catch {
      // ignore
    }
  }

  let emailSent = false;
  try {
    const passwordPlain = crypto.randomBytes(12).toString("base64url");
    const passwordHash = hashPassword(passwordPlain);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, createdUserId));

    const res = await sendWelcomeEmail({ to: targetEmail, username: createdUsername, passwordPlain });
    emailSent = res.ok;
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, id: createdUserId, username: createdUsername, emailSent });
}
