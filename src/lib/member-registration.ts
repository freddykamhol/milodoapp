import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { memberRegistrationForms, memberRegistrationSubmissions, users } from "@/db/schema";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export type RegistrationRole = "ADMIN" | "VERWALTUNG" | "PERSONAL";
export type VerificationMode = "ADMIN" | "PASSWORD";
export type PasswordMode = "SELF" | "GENERATED";

export type MemberRegistrationPayload = {
  firstName: string;
  lastName: string;
  geb?: string | null;
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  ortErgaenzung?: string | null;
  email: string;
  telefon?: string | null;
  qualRD?: "SAN" | "RH" | "RS" | "RA" | "NFS" | null;
  qualAusb?: "AUSBILDER" | null;
  einsatzort?: "AUSBILDUNG" | "RD" | "BEIDE" | null;
  password?: string | null;
  verificationPassword?: string | null;
};

const passwordWords = [
  "Sonne",
  "Wiese",
  "Kompass",
  "Licht",
  "Hafen",
  "Morgen",
  "Quelle",
  "Fokus",
  "Bruecke",
  "Signal",
  "Wolke",
  "Anker",
];

export function createRegistrationToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function generateReadablePassword() {
  const word = passwordWords[crypto.randomInt(passwordWords.length)];
  const digits = String(crypto.randomInt(0, 10000)).padStart(4, "0");
  const special = [",", "!", "."][crypto.randomInt(3)];
  return `${word}${digits}${special}`;
}

export function hashVerificationPassword(password: string) {
  return hashPassword(password);
}

export function verifyRegistrationPassword(plain: string, stored: string | null) {
  if (!stored) return false;
  return verifyPassword(plain, stored);
}

export function normalizeBasic(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeEmail(value: unknown) {
  return normalizeBasic(value).toLowerCase();
}

export function deSlug(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ß", "ss")
    .replaceAll(/[^a-z0-9]/g, "");
}

async function usernameExists(username: string) {
  const row = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.username, username),
    columns: { id: true },
  });
  return Boolean(row?.id);
}

export async function buildInternUsername(firstName: string, lastName: string) {
  const fn = deSlug(firstName);
  const ln = deSlug(lastName);
  if (!fn || !ln) return "";

  for (let i = 1; i <= Math.min(fn.length, 4); i += 1) {
    const candidate = `${fn.slice(0, i)}${ln}`;
    if (!(await usernameExists(candidate))) return candidate;
  }

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${fn.slice(0, Math.min(fn.length, 4))}${ln}${n}`;
    if (!(await usernameExists(candidate))) return candidate;
  }

  return "";
}

export async function countFormSubmissions(formId: number) {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(memberRegistrationSubmissions)
    .where(eq(memberRegistrationSubmissions.formId, formId));
  return Number(rows.at(0)?.count ?? 0);
}

export async function findActiveRegistrationForm(token: string) {
  const form = await db.query.memberRegistrationForms.findFirst({
    where: (table, { eq }) => eq(table.token, token),
  });
  if (!form || !form.active) return { form: null, used: 0, reason: "not_found" as const };
  if (form.expiresAt.getTime() < Date.now()) return { form, used: 0, reason: "expired" as const };

  const used = await countFormSubmissions(form.id);
  if (used >= form.userLimit) return { form, used, reason: "limit_reached" as const };
  return { form, used, reason: null };
}

export async function createRegisteredMember({
  formId,
  payload,
  role,
  verificationMode,
  password,
}: {
  formId: number;
  payload: MemberRegistrationPayload;
  role: RegistrationRole;
  verificationMode: VerificationMode;
  password: string;
}) {
  const firstName = normalizeBasic(payload.firstName);
  const lastName = normalizeBasic(payload.lastName);
  const email = normalizeEmail(payload.email);
  const telefon = normalizeBasic(payload.telefon);

  if (!firstName || !lastName) return { ok: false as const, error: "invalid_name" };
  if (!email) return { ok: false as const, error: "invalid_email" };
  if (!password || password.length < 8) return { ok: false as const, error: "invalid_password" };

  const username = await buildInternUsername(firstName, lastName);
  if (!username) return { ok: false as const, error: "username_failed" };

  const gebIso = normalizeBasic(payload.geb);
  const geb = gebIso ? new Date(gebIso) : null;
  if (gebIso && Number.isNaN(geb!.getTime())) return { ok: false as const, error: "invalid_geb" };

  try {
    const inserted = await db.transaction((tx) => {
      const userRows = tx
        .insert(users)
        .values({
          username,
          passwordHash: hashPassword(password),
          role,
          firstName,
          lastName,
          qualRD:
            payload.qualRD && ["SAN", "RH", "RS", "RA", "NFS"].includes(payload.qualRD)
              ? payload.qualRD
              : null,
          qualAusb: payload.qualAusb === "AUSBILDER" ? "AUSBILDER" : null,
          einsatzort:
            payload.einsatzort && ["AUSBILDUNG", "RD", "BEIDE"].includes(payload.einsatzort)
              ? payload.einsatzort
              : null,
          geb: geb ?? undefined,
          strasse: normalizeBasic(payload.strasse) || null,
          hausnummer: normalizeBasic(payload.hausnummer) || null,
          plz: normalizeBasic(payload.plz) || null,
          ort: normalizeBasic(payload.ort) || null,
          ortErgaenzung: normalizeBasic(payload.ortErgaenzung) || "",
          email,
          telefon: telefon || null,
          locked: verificationMode === "ADMIN",
        })
        .returning({ id: users.id, username: users.username })
        .all();

      const user = userRows.at(0);
      if (!user) return null;

      tx.insert(memberRegistrationSubmissions)
        .values({
          formId,
          userId: user.id,
          status: verificationMode === "ADMIN" ? "PENDING" : "APPROVED",
          approvedAt: verificationMode === "PASSWORD" ? new Date() : null,
        })
        .run();

      return user;
    });

    if (!inserted) return { ok: false as const, error: "create_failed" };
    return { ok: true as const, id: inserted.id, username: inserted.username };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    console.error("Member registration could not be created", {
      formId,
      error: message,
    });
    if (message.includes("users.email")) return { ok: false as const, error: "email_exists" };
    if (message.includes("users.username")) return { ok: false as const, error: "username_exists" };
    if (message.includes("member_registration_submissions")) {
      return { ok: false as const, error: "registration_tables_missing" };
    }
    return { ok: false as const, error: "create_failed" };
  }
}

export async function listRegistrationForms() {
  const forms = await db.query.memberRegistrationForms.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const counts = await db
    .select({
      formId: memberRegistrationSubmissions.formId,
      used: sql<number>`count(*)`,
      pending: sql<number>`sum(case when ${memberRegistrationSubmissions.status} = 'PENDING' then 1 else 0 end)`,
    })
    .from(memberRegistrationSubmissions)
    .groupBy(memberRegistrationSubmissions.formId);

  const countByForm = new Map(counts.map((row) => [row.formId, row]));

  return forms.map((form) => {
    const count = countByForm.get(form.id);
    return {
      ...form,
      used: Number(count?.used ?? 0),
      pending: Number(count?.pending ?? 0),
    };
  });
}

export async function hasPendingRegistration(userId: number) {
  const row = await db.query.memberRegistrationSubmissions.findFirst({
    where: (table) => and(eq(table.userId, userId), eq(table.status, "PENDING")),
    columns: { id: true },
  });
  return Boolean(row?.id);
}
