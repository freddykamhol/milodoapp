import crypto from "node:crypto";
import path from "node:path";
import { mkdir, rename, readFile, writeFile } from "node:fs/promises";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { documents, personalQuestionnaireFiles, personalQuestionnaires, users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { buildUserRemoteDir, buildUserRemoteFilePath, isSftpEnabled, withSftp } from "@/lib/sftp";
import { getViewer } from "@/lib/viewer";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import { ensurePersonalfrageboegenSchema } from "@/lib/personalfrageboegen";
import { getDataDir } from "@/lib/data-dir";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
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
  const row = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.username, username),
    columns: { id: true },
  });
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

function mapQualRd(qualMed: string | null) {
  if (qualMed === "SANITAETER") return "SAN";
  if (qualMed === "RETTUNGSHELFER") return "RH";
  if (qualMed === "RETTUNGSSANITAETER") return "RS";
  if (qualMed === "RETTUNGSASSISTENT") return "RA";
  if (qualMed === "NOTFALLSANITAETER") return "NFS";
  if (qualMed === "ERSTHELFER") return "SAN";
  return null;
}

function mapEinsatzort(einsatzfelder: string[]) {
  const hasAusb = einsatzfelder.includes("ERSTE_HILFE_AUSBILDUNG");
  const hasRd = einsatzfelder.includes("RETTUNGSDIENST") || einsatzfelder.includes("SANITAETSDIENST");
  if (hasAusb && hasRd) return "BEIDE";
  if (hasAusb) return "AUSBILDUNG";
  return hasRd ? "RD" : null;
}

function kindToTitle(kind: string) {
  if (kind === "ZEUGNIS_MED") return "Zeugnis medizinische Qualifikation";
  if (kind === "FORTBILDUNG_RD") return "Rettungsdienst Fortbildungsnachweis";
  if (kind === "ARBEITSMED") return "Arbeitsmedizinische Untersuchung";
  if (kind === "FUEHRUNGSKRAEFTE") return "Führungskräfte Ausbildung";
  if (kind === "AUSBILDER_QUAL") return "Ausbilder-Qualifikation";
  if (kind === "FUEHRERSCHEIN") return "Führerschein";
  if (kind === "PSS") return "Personenbeförderungsschein";
  return "Sonstige Dokumente";
}

function kindToCategory(kind: string): "TRAINING" | "CONTRACT" {
  if (kind === "FUEHRERSCHEIN" || kind === "PSS" || kind === "ARBEITSMED") return "CONTRACT";
  return "TRAINING";
}

function safeFileName(name: string) {
  return String(name || "upload.bin")
    .replaceAll(/[^\w.\- ()]/g, "_")
    .replaceAll(/_+/g, "_")
    .slice(0, 160);
}

function splitExt(name: string) {
  const ext = path.extname(name || "").slice(0, 10);
  const base = (name || "").slice(0, Math.max(0, name.length - ext.length));
  return { base, ext };
}

async function moveLocalFile({ fromKey, toUserId, storedName }: { fromKey: string; toUserId: number; storedName: string }) {
  const fromPath = path.join(getDataDir(), fromKey);
  const dir = path.join(getDataDir(), "uploads", String(toUserId));
  await mkdir(dir, { recursive: true });
  const toPath = path.join(dir, storedName);
  try {
    await rename(fromPath, toPath);
  } catch {
    // cross-device or missing rename support
    const bytes = await readFile(fromPath);
    await writeFile(toPath, bytes);
  }
}

async function moveSftpFile({
  fromKey,
  toUsername,
  storedName,
}: {
  fromKey: string;
  toUsername: string;
  storedName: string;
}) {
  const res = await withSftp(async (client, basePath) => {
    const fromRemote = path.posix.join(basePath, fromKey);
    await client.mkdir(buildUserRemoteDir(basePath, toUsername), true);
    const toRemote = buildUserRemoteFilePath(basePath, toUsername, storedName);
    try {
      await (client as any).rename(fromRemote, toRemote);
      return true;
    } catch {
      const data = (await client.get(fromRemote)) as unknown;
      const buf = Buffer.isBuffer(data) ? data : data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(String(data));
      await client.put(buf, toRemote);
      try {
        await (client as any).delete(fromRemote);
      } catch {
        // ignore
      }
      return true;
    }
  });
  if (!res) throw new Error("sftp_not_available");
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await ensurePersonalfrageboegenSchema();

  const { id } = await params;
  const questionnaireId = Number(id);
  if (!Number.isFinite(questionnaireId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const questionnaire = await db.query.personalQuestionnaires.findFirst({
    where: (t, { eq }) => eq(t.id, questionnaireId),
    with: { files: true },
  });
  if (!questionnaire) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const alreadyUserId = Number(questionnaire.createdUserId ?? NaN);
  if (Number.isFinite(alreadyUserId)) {
    const existing = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, alreadyUserId) });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, username: existing.username, emailSent: false, already: true });
    }
  }

  const email = String(questionnaire.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });

  const existingByEmail = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, email) });
  if (existingByEmail) {
    return NextResponse.json(
      { ok: false, error: "user_exists", username: existingByEmail.username },
      { status: 409 },
    );
  }

  const firstName = String(questionnaire.firstName || "").trim();
  const lastName = String(questionnaire.lastName || "").trim();
  if (!firstName || !lastName) return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });

  const username = await buildInternUsername(firstName, lastName);
  if (!username) return NextResponse.json({ ok: false, error: "username_failed" }, { status: 500 });

  const randomSecret = crypto.randomBytes(24).toString("base64url");
  const passwordHash = hashPassword(randomSecret);

  let einsatzfelder: string[] = [];
  try {
    const parsed = JSON.parse(String(questionnaire.einsatzfelderJson ?? "[]"));
    einsatzfelder = Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    // ignore
  }

  const inserted = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      role: "PERSONAL",
      firstName,
      lastName,
      geb: questionnaire.geb ?? undefined,
      email,
      telefon: String(questionnaire.phone || "").trim() || null,
      qualRD: mapQualRd(String(questionnaire.qualMed || "").trim() || null) as any,
      qualAusb: questionnaire.qualEhAusbilder ? ("AUSBILDER" as any) : null,
      einsatzort: mapEinsatzort(einsatzfelder) as any,
      strasse: String(questionnaire.street || "").trim() || null,
      hausnummer: String(questionnaire.houseNumber || "").trim() || null,
      plz: String(questionnaire.plz || "").trim() || null,
      ort: String(questionnaire.city || "").trim() || null,
      ortErgaenzung: String(questionnaire.cityExtra || "").trim(),
    })
    .returning({ id: users.id, username: users.username });

  const userId = inserted.at(0)?.id ?? null;
  if (!userId) return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });

  const createdUsername = inserted.at(0)?.username ?? username;

  // Move uploaded docs into user folder and create `documents` records.
  const fileRows = (questionnaire.files ?? []) as Array<typeof personalQuestionnaireFiles.$inferSelect>;
  const sftpOn = await isSftpEnabled();
  let moved = 0;

  for (const f of fileRows) {
    const originalName = safeFileName(String(f.originalName || f.fileName || "upload.bin"));
    const { ext } = splitExt(originalName);
    const hasExt = Boolean(ext);
    const storedName = hasExt ? String(f.fileName) : `${String(f.fileName)}${ext || ""}`;

    const fromKey = String(f.storageKey || "").replaceAll("\\", "/");
    if (!fromKey || fromKey.includes("..") || fromKey.startsWith("/")) continue;

    if (sftpOn) {
      await moveSftpFile({ fromKey, toUsername: createdUsername, storedName });
    } else {
      await moveLocalFile({ fromKey, toUserId: userId, storedName });
    }

    const newStorageKey = sftpOn ? `${createdUsername}/${storedName}` : `${userId}/${storedName}`;

    await db.update(personalQuestionnaireFiles).set({ storageKey: newStorageKey, updatedAt: new Date() }).where(eq(personalQuestionnaireFiles.id, f.id));

    const title = kindToTitle(String(f.kind || ""));
    await db.insert(documents).values({
      ownerId: userId,
      title,
      category: kindToCategory(String(f.kind || "")),
      fileName: originalName,
      mimeType: f.mimeType ?? null,
      storageKey: newStorageKey,
      sizeBytes: f.sizeBytes ?? null,
    });

    moved += 1;
  }

  await db
    .update(personalQuestionnaires)
    .set({
      status: questionnaire.status === "SUBMITTED" ? "REVIEWED" : questionnaire.status,
      createdUserId: userId,
      createdUsername,
      createdUserAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(personalQuestionnaires.id, questionnaireId));

  let emailSent = false;
  try {
    const passwordPlain = crypto.randomBytes(12).toString("base64url");
    const passwordHash = hashPassword(passwordPlain);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

    const res = await sendWelcomeEmail({ to: email, username: createdUsername, passwordPlain });
    emailSent = res.ok;
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, id: userId, username: createdUsername, emailSent, movedFiles: moved });
}
