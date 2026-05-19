import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { getViewer } from "@/lib/viewer";
import { sendWelcomeEmail } from "@/lib/welcome-email";

export const runtime = "nodejs";

function normBasic(v: unknown) {
  return String(v ?? "").trim();
}

function normEmail(v: unknown) {
  return normBasic(v).toLowerCase();
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

function parseBoolean(value: string) {
  const s = value.trim().toLowerCase();
  if (!s) return null;
  if (["1", "true", "yes", "y", "ja"].includes(s)) return true;
  if (["0", "false", "no", "n", "nein"].includes(s)) return false;
  return null;
}

function parseOptionalIsoDate(value: string) {
  const s = value.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseCsv(text: string) {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] as string[][] };

  const delimiter = lines[0]!.includes(";") ? ";" : ",";

  // Very small CSV parser (supports quotes, delimiter, and newlines already split).
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === delimiter) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const headers = parseLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
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
  for (let n = 2; n < 1000; n++) {
    const candidate = `${fn.slice(0, Math.min(fn.length, 4))}${ln}${n}`;
    if (!(await usernameExists(candidate))) return candidate;
  }
  return "";
}

type ImportRow = {
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "VERWALTUNG" | "PERSONAL";
  qualRD: "SAN" | "RH" | "RS" | "RA" | "NFS" | null;
  qualAusb: "AUSBILDER" | null;
  einsatzort: "AUSBILDUNG" | "RD" | "BEIDE" | null;
  geb: Date | null;
  telefon: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  ortErgaenzung: string;
  locked: boolean | null;
};

function rowFromRecord(rec: Record<string, string>): { ok: true; row: ImportRow } | { ok: false; error: string } {
  const firstName = normBasic(rec.first_name ?? rec.firstname ?? rec.vorname);
  const lastName = normBasic(rec.last_name ?? rec.lastname ?? rec.nachname);
  const email = normEmail(rec.email ?? rec.mail ?? rec.e_mail);

  const roleRaw = normBasic(rec.role ?? rec.rolle).toUpperCase();
  const role =
    roleRaw === "ADMIN" || roleRaw === "VERWALTUNG" || roleRaw === "PERSONAL" ? (roleRaw as ImportRow["role"]) : "PERSONAL";

  const qualRdRaw = normBasic(rec.qual_rd ?? rec.qualrd ?? rec.qualifikation_rd).toUpperCase();
  const qualRD =
    qualRdRaw && ["SAN", "RH", "RS", "RA", "NFS"].includes(qualRdRaw) ? (qualRdRaw as NonNullable<ImportRow["qualRD"]>) : null;

  const qualAusbRaw = normBasic(rec.qual_ausb ?? rec.qualausb ?? rec.qualifikation_ausb).toUpperCase();
  const qualAusb = qualAusbRaw === "AUSBILDER" ? "AUSBILDER" : null;

  const einsatzortRaw = normBasic(rec.einsatzort ?? rec.einsatz_ort).toUpperCase();
  const einsatzort =
    einsatzortRaw && ["AUSBILDUNG", "RD", "BEIDE"].includes(einsatzortRaw)
      ? (einsatzortRaw as NonNullable<ImportRow["einsatzort"]>)
      : null;

  const geb = parseOptionalIsoDate(normBasic(rec.geb ?? rec.geburtstag ?? rec.birthday));
  const telefon = normBasic(rec.telefon ?? rec.phone) || null;
  const strasse = normBasic(rec.strasse ?? rec.street) || null;
  const hausnummer = normBasic(rec.hausnummer ?? rec.house_number ?? rec.housenumber) || null;
  const plz = normBasic(rec.plz ?? rec.zip) || null;
  const ort = normBasic(rec.ort ?? rec.city) || null;
  const ortErgaenzung = normBasic(rec.ort_ergaenzung ?? rec.orterg ?? rec.city_extra) || "";
  const lockedParsed = parseBoolean(normBasic(rec.locked ?? rec.gesperrt));

  if (!firstName || !lastName) return { ok: false, error: "invalid_name" };
  if (!email || !email.includes("@")) return { ok: false, error: "invalid_email" };

  return {
    ok: true,
    row: {
      firstName,
      lastName,
      email,
      role,
      qualRD,
      qualAusb,
      einsatzort,
      geb,
      telefon,
      strasse,
      hausnummer,
      plz,
      ort,
      ortErgaenzung,
      locked: lockedParsed,
    },
  };
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let csvText = "";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
    csvText = await file.text();
  } else {
    csvText = await request.text();
  }

  const { headers, rows } = parseCsv(csvText);
  if (!headers.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const toRecord = (cells: string[]) => {
    const rec: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) rec[headers[i]!] = cells[i] ?? "";
    return rec;
  };

  const results: Array<
    | { idx: number; ok: true; id: number; username: string; emailSent: boolean }
    | { idx: number; ok: false; error: string }
  > = [];

  let created = 0;
  let emailed = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const idx = i + 2; // line number in CSV (header=1)
    const rec = toRecord(rows[i]!);
    const parsed = rowFromRecord(rec);
    if (!parsed.ok) {
      results.push({ idx, ok: false, error: parsed.error });
      continue;
    }

    const row = parsed.row;

    const username = await buildInternUsername(row.firstName, row.lastName);
    if (!username) {
      results.push({ idx, ok: false, error: "username_failed" });
      continue;
    }

    // generate password (never store plain)
    const passwordPlain = crypto.randomBytes(12).toString("base64url");
    const passwordHash = hashPassword(passwordPlain);

    try {
      const inserted = await db
        .insert(users)
        .values({
          username,
          passwordHash,
          role: row.role,
          firstName: row.firstName,
          lastName: row.lastName,
          qualRD: row.qualRD,
          qualAusb: row.qualAusb,
          einsatzort: row.einsatzort,
          geb: row.geb ?? undefined,
          strasse: row.strasse,
          hausnummer: row.hausnummer,
          plz: row.plz,
          ort: row.ort,
          ortErgaenzung: row.ortErgaenzung,
          email: row.email,
          telefon: row.telefon,
          locked: row.locked ?? false,
        })
        .returning({ id: users.id, username: users.username });

      const id = inserted.at(0)?.id ?? null;
      const insertedUsername = inserted.at(0)?.username ?? username;
      if (!id) {
        results.push({ idx, ok: false, error: "insert_failed" });
        continue;
      }

      let emailSent = false;
      try {
        const mailRes = await sendWelcomeEmail({ to: row.email, username: insertedUsername, passwordPlain });
        emailSent = mailRes.ok;
      } catch {
        // ignore
      }

      if (!emailSent) {
        // If we couldn't email credentials, lock the account to prevent unknown login.
        await db.update(users).set({ locked: true, updatedAt: new Date() }).where(eq(users.id, id));
      }

      created += 1;
      if (emailSent) emailed += 1;
      results.push({ idx, ok: true, id, username: insertedUsername, emailSent });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      results.push({ idx, ok: false, error: msg });
    }
  }

  return NextResponse.json({ ok: true, created, emailed, results });
}

