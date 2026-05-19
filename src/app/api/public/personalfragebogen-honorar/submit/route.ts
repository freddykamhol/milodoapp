import { NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { db } from "@/lib/db";
import { personalQuestionnaireFiles, personalQuestionnaires } from "@/db/schema";
import { isSftpEnabled, withSftp } from "@/lib/sftp";
import { getDataDir } from "@/lib/data-dir";
import { sql } from "drizzle-orm";
import { renderPersonalfragebogenHonorarPdf } from "@/lib/personalfrageboegen-pdf";
import { sendPersonalfragebogenConfirmationEmail } from "@/lib/personalfrageboegen-confirmation-email";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

type FileKind =
  | "ZEUGNIS_MED"
  | "FORTBILDUNG_RD"
  | "ARBEITSMED"
  | "FUEHRUNGSKRAEFTE"
  | "AUSBILDER_QUAL"
  | "SONSTIGE"
  | "FUEHRERSCHEIN"
  | "PSS";

function safeFileName(name: string) {
  return String(name || "upload.bin")
    .replaceAll(/[^\w.\- ()]/g, "_")
    .replaceAll(/_+/g, "_")
    .slice(0, 180);
}

function parseBool(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parseJsonArray(raw: unknown) {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: unknown) {
  try {
    const parsed = JSON.parse(String(raw ?? "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseDateMs(raw: unknown) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // expects yyyy-mm-dd
  const ms = Date.parse(`${s}T00:00:00.000Z`);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function storageKeyFor(questionnaireId: number, storedName: string) {
  return `Personalfrageboegen/HONORAR/${questionnaireId}/${storedName}`;
}

async function ensureTables() {
  // Safety net: if migrations weren't applied yet, create the required tables lazily.
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS personal_questionnaires (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      kind text NOT NULL DEFAULT 'HONORAR',
      status text NOT NULL DEFAULT 'SUBMITTED',
      first_name text NOT NULL DEFAULT '',
      last_name text NOT NULL DEFAULT '',
      geb integer,
      tax_number text NOT NULL DEFAULT '',
      nationality text NOT NULL DEFAULT '',
      street text NOT NULL DEFAULT '',
      house_number text NOT NULL DEFAULT '',
      plz text NOT NULL DEFAULT '',
      city text NOT NULL DEFAULT '',
      city_extra text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',
      phone_share integer NOT NULL DEFAULT 0,
      email text NOT NULL DEFAULT '',
      bank_account_holder text NOT NULL DEFAULT '',
      bank_account_holder_differs integer NOT NULL DEFAULT 0,
      bank_name text NOT NULL DEFAULT '',
      iban text NOT NULL DEFAULT '',
      blz text NOT NULL DEFAULT '',
      einsatzfelder_json text NOT NULL DEFAULT '[]',
      qual_med text,
      qual_eh_ausbilder integer NOT NULL DEFAULT 0,
      sizes_json text NOT NULL DEFAULT '{}',
      has_neutral_psa integer NOT NULL DEFAULT 0,
      driver_licences_json text NOT NULL DEFAULT '[]',
      has_pss integer NOT NULL DEFAULT 0,
      own_car integer NOT NULL DEFAULT 0,
      contact_prefs_json text NOT NULL DEFAULT '[]',
      raw_json text NOT NULL DEFAULT '{}',
      created_user_id integer,
      created_username text NOT NULL DEFAULT '',
      created_user_at integer,
      social_security_number text NOT NULL DEFAULT '',
      tax_id text NOT NULL DEFAULT '',
      health_insurance text NOT NULL DEFAULT '',
      insurance_status text NOT NULL DEFAULT '',
      marital_status text NOT NULL DEFAULT '',
      has_children integer NOT NULL DEFAULT 0,
      children_count integer,
      employment_status_json text NOT NULL DEFAULT '[]',
      employment_status_other text NOT NULL DEFAULT '',
      has_main_job integer NOT NULL DEFAULT 0,
      main_job_employer text NOT NULL DEFAULT '',
      has_other_minijobs integer NOT NULL DEFAULT 0,
      other_minijobs_count integer,
      other_minijobs_employers text NOT NULL DEFAULT '',
      pension_choice text NOT NULL DEFAULT '',
      tax_class text NOT NULL DEFAULT '',
      confession text NOT NULL DEFAULT '',
      admin_notes text NOT NULL DEFAULT ''
    );
  `);

  await db.run(sql`CREATE INDEX IF NOT EXISTS personal_questionnaires_kind_idx ON personal_questionnaires (kind);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS personal_questionnaires_status_idx ON personal_questionnaires (status);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS personal_questionnaires_created_at_idx ON personal_questionnaires (created_at);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS personal_questionnaires_email_idx ON personal_questionnaires (email);`);
  // Add missing columns for older tables (ignore if already exists)
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN created_user_id integer;`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN created_username text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN created_user_at integer;`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN nationality text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN social_security_number text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN tax_id text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN health_insurance text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN insurance_status text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN marital_status text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN has_children integer NOT NULL DEFAULT 0;`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN children_count integer;`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN employment_status_json text NOT NULL DEFAULT '[]';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN employment_status_other text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN has_main_job integer NOT NULL DEFAULT 0;`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN main_job_employer text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN has_other_minijobs integer NOT NULL DEFAULT 0;`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN other_minijobs_count integer;`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN other_minijobs_employers text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN pension_choice text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN tax_class text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN confession text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS personal_questionnaires_created_user_id_idx ON personal_questionnaires (created_user_id);`,
  );

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS personal_questionnaire_files (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      questionnaire_id integer NOT NULL,
      kind text NOT NULL,
      file_name text NOT NULL,
      original_name text NOT NULL DEFAULT '',
      mime_type text,
      storage_key text NOT NULL,
      size_bytes integer,
      FOREIGN KEY (questionnaire_id) REFERENCES personal_questionnaires(id) ON DELETE cascade
    );
  `);
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS personal_questionnaire_files_storage_key_unique ON personal_questionnaire_files (storage_key);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS personal_questionnaire_files_questionnaire_id_idx ON personal_questionnaire_files (questionnaire_id);`,
  );
  await db.run(sql`CREATE INDEX IF NOT EXISTS personal_questionnaire_files_kind_idx ON personal_questionnaire_files (kind);`);
}

async function storeFile(questionnaireId: number, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("file_too_large");

  const uuid = crypto.randomUUID();
  const cleaned = safeFileName(file.name || "upload.bin");
  const storedName = `${uuid}-${cleaned}`;
  const storageKey = storageKeyFor(questionnaireId, storedName);

  const sftpOn = await isSftpEnabled();
  if (sftpOn) {
    const res = await withSftp(async (client, basePath) => {
      const remoteDir = path.posix.join(basePath, "Personalfrageboegen", "HONORAR", String(questionnaireId));
      await client.mkdir(remoteDir, true);
      const remoteFile = path.posix.join(remoteDir, storedName);
      await client.put(bytes, remoteFile);
      return true;
    });
    if (!res) throw new Error("sftp_not_available");
  } else {
    const diskPath = path.join(getDataDir(), storageKey);
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, bytes);
  }

  return {
    storedName,
    storageKey,
    sizeBytes: bytes.byteLength,
    mimeType: file.type || null,
    originalName: String(file.name || ""),
  };
}

export async function POST(request: Request) {
  await ensureTables();
  const form = await request.formData();

  // Honeypot (bots tend to fill everything)
  const honey = String(form.get("website") ?? "").trim();
  if (honey) return NextResponse.json({ ok: true });

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ ok: false, error: "missing_required" }, { status: 400 });
  }

  const phone = String(form.get("phone") ?? "").trim();
  const phoneShare = parseBool(form.get("phoneShare"));
  const taxNumber = String(form.get("taxNumber") ?? "").trim();
  const taxNumberLater = parseBool(form.get("taxNumberLater"));
  const nationality = String(form.get("nationality") ?? "").trim();

  const street = String(form.get("street") ?? "").trim();
  const houseNumber = String(form.get("houseNumber") ?? "").trim();
  const plz = String(form.get("plz") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const cityExtra = String(form.get("cityExtra") ?? "").trim();

  const gebDate = parseDateMs(form.get("geb"));

  const bankAccountHolderDiffers = parseBool(form.get("bankAccountHolderDiffers"));
  const bankAccountHolder = String(form.get("bankAccountHolder") ?? "").trim();
  const bankName = String(form.get("bankName") ?? "").trim();
  const iban = String(form.get("iban") ?? "").trim();
  const blz = String(form.get("blz") ?? "").trim();

  const einsatzfelder = parseJsonArray(form.get("einsatzfelderJson"));
  const qualMedRaw = String(form.get("qualMed") ?? "").trim();
  const allowedQualMed = [
    "ERSTHELFER",
    "SANITAETER",
    "RETTUNGSHELFER",
    "RETTUNGSSANITAETER",
    "RETTUNGSASSISTENT",
    "NOTFALLSANITAETER",
  ] as const;
  const qualMed = (allowedQualMed as readonly string[]).includes(qualMedRaw)
    ? (qualMedRaw as (typeof allowedQualMed)[number])
    : (qualMedRaw ? null : null);
  if (qualMedRaw && !qualMed) {
    return NextResponse.json({ ok: false, error: "qual_med_invalid" }, { status: 400 });
  }
  const qualEhAusbilder = parseBool(form.get("qualEhAusbilder"));

  const sizes = parseJsonObject(form.get("sizesJson"));
  const hasNeutralPsa = parseBool(form.get("hasNeutralPsa"));

  const driverLicences = parseJsonArray(form.get("driverLicencesJson"));
  const hasPss = parseBool(form.get("hasPss"));
  const ownCar = parseBool(form.get("ownCar"));

  const contactPrefs = parseJsonArray(form.get("contactPrefsJson"));

  // server-side required checks (client does this too, but don't trust it)
  if (!gebDate) return NextResponse.json({ ok: false, error: "missing_required" }, { status: 400 });
  if (!phone) return NextResponse.json({ ok: false, error: "missing_required" }, { status: 400 });
  if (!street || !houseNumber || !plz || !city) {
    return NextResponse.json({ ok: false, error: "missing_required" }, { status: 400 });
  }
  if (!nationality) return NextResponse.json({ ok: false, error: "missing_required" }, { status: 400 });
  if (!taxNumber && !taxNumberLater) {
    return NextResponse.json({ ok: false, error: "tax_required_or_later" }, { status: 400 });
  }

  const needsMed = einsatzfelder.includes("RETTUNGSDIENST") || einsatzfelder.includes("SANITAETSDIENST");
  if (needsMed && !qualMed) {
    return NextResponse.json({ ok: false, error: "qual_med_required" }, { status: 400 });
  }
  const needsAusbilder = einsatzfelder.includes("ERSTE_HILFE_AUSBILDUNG");
  if (needsAusbilder && !qualEhAusbilder) {
    return NextResponse.json({ ok: false, error: "ausbilder_required" }, { status: 400 });
  }

  const rawJson = {
    firstName,
    lastName,
    geb: gebDate ? gebDate.toISOString() : null,
    taxNumber,
    taxNumberLater,
    nationality,
    street,
    houseNumber,
    plz,
    city,
    cityExtra,
    phone,
    phoneShare,
    email,
    bankAccountHolderDiffers,
    bankAccountHolder,
    bankName,
    iban,
    blz,
    einsatzfelder,
    qualMed,
    qualEhAusbilder,
    sizes,
    hasNeutralPsa,
    driverLicences,
    hasPss,
    ownCar,
    contactPrefs,
  };

  const inserted = await db
    .insert(personalQuestionnaires)
    .values({
      kind: "HONORAR",
      status: "SUBMITTED",
      firstName,
      lastName,
      geb: gebDate,
      taxNumber,
      nationality,
      street,
      houseNumber,
      plz,
      city,
      cityExtra,
      phone,
      phoneShare,
      email,
      bankAccountHolder,
      bankAccountHolderDiffers,
      bankName,
      iban,
      blz,
      einsatzfelderJson: JSON.stringify(einsatzfelder),
      qualMed,
      qualEhAusbilder,
      sizesJson: JSON.stringify(sizes),
      hasNeutralPsa,
      driverLicencesJson: JSON.stringify(driverLicences),
      hasPss,
      ownCar,
      contactPrefsJson: JSON.stringify(contactPrefs),
      rawJson: JSON.stringify(rawJson),
    })
    .returning({ id: personalQuestionnaires.id });

  const questionnaireId = inserted.at(0)?.id ?? null;
  if (!questionnaireId) {
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  const toInsert: Array<typeof personalQuestionnaireFiles.$inferInsert> = [];

  for (const [key, value] of form.entries()) {
    if (!(value instanceof File)) continue;
    if (!key.startsWith("file:")) continue;
    const kind = key.slice("file:".length) as FileKind;
    if (
      kind !== "ZEUGNIS_MED" &&
      kind !== "FORTBILDUNG_RD" &&
      kind !== "ARBEITSMED" &&
      kind !== "FUEHRUNGSKRAEFTE" &&
      kind !== "AUSBILDER_QUAL" &&
      kind !== "SONSTIGE" &&
      kind !== "FUEHRERSCHEIN" &&
      kind !== "PSS"
    ) {
      continue;
    }

    try {
      const stored = await storeFile(questionnaireId, value);
      toInsert.push({
        questionnaireId,
        kind,
        fileName: stored.storedName,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        storageKey: stored.storageKey,
        sizeBytes: stored.sizeBytes,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "upload_failed";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
  }

  if (toInsert.length) {
    await db.insert(personalQuestionnaireFiles).values(toInsert);
  }

  let emailSent = false;
  try {
    const pdfBytes = await renderPersonalfragebogenHonorarPdf({
      questionnaire: {
        id: questionnaireId,
        createdAt: new Date(),
        firstName,
        lastName,
        geb: gebDate ?? null,
        taxNumber: taxNumber || (taxNumberLater ? "wird nachgereicht" : ""),
        street,
        houseNumber,
        plz,
        city,
        cityExtra,
        phone,
        phoneShare,
        email,
        bankAccountHolder,
        bankAccountHolderDiffers,
        bankName,
        iban,
        blz,
        einsatzfelderJson: JSON.stringify(einsatzfelder),
        qualMed,
        qualEhAusbilder,
        sizesJson: JSON.stringify(sizes),
        hasNeutralPsa,
        driverLicencesJson: JSON.stringify(driverLicences),
        hasPss,
        ownCar,
        contactPrefsJson: JSON.stringify(contactPrefs),
      },
      uploadedCount: toInsert.length,
    });
    const res = await sendPersonalfragebogenConfirmationEmail({ to: email, questionnaireId, pdfBytes });
    emailSent = res.ok;
  } catch {
    // ignore (submission must still succeed even if SMTP fails)
  }

  return NextResponse.json({ ok: true, id: questionnaireId, emailSent });
}
