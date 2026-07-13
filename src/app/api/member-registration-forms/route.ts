import { NextResponse } from "next/server";

import { memberRegistrationForms } from "@/db/schema";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import {
  createRegistrationToken,
  generateReadablePassword,
  hashVerificationPassword,
  listRegistrationForms,
  normalizeBasic,
  type PasswordMode,
  type RegistrationRole,
  type VerificationMode,
} from "@/lib/member-registration";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function toIsoDate(date: Date) {
  return date.toISOString();
}

function linkForToken(token: string, request: Request) {
  const origin = request.headers.get("origin") || new URL(request.url).origin;
  return `${getAppUrl({ fallbackOrigin: origin })}/registrierung/${token}`;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const forms = await listRegistrationForms();

  return NextResponse.json({
    ok: true,
    forms: forms.map((form) => ({
      id: form.id,
      title: form.title,
      role: form.role,
      userLimit: form.userLimit,
      used: form.used,
      pending: form.pending,
      verificationMode: form.verificationMode,
      passwordMode: form.passwordMode,
      hasVerificationPassword: Boolean(form.verificationPasswordHash),
      verificationPassword: form.verificationPasswordSecret ? decryptSecret(form.verificationPasswordSecret) : "",
      expiresAt: toIsoDate(form.expiresAt),
      active: form.active,
      link: linkForToken(form.token, request),
    })),
  });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const userLimit = Math.max(1, Math.min(1000, Math.round(Number(body.userLimit ?? 0))));
  if (!Number.isFinite(userLimit)) {
    return NextResponse.json({ ok: false, error: "invalid_user_limit" }, { status: 400 });
  }

  const roleValue = normalizeBasic(body.role);
  const role: RegistrationRole =
    roleValue === "ADMIN" || roleValue === "VERWALTUNG" || roleValue === "PERSONAL" ? roleValue : "PERSONAL";

  const verificationValue = normalizeBasic(body.verificationMode);
  const verificationMode: VerificationMode = verificationValue === "PASSWORD" ? "PASSWORD" : "ADMIN";

  const passwordValue = normalizeBasic(body.passwordMode);
  const passwordMode: PasswordMode = passwordValue === "GENERATED" ? "GENERATED" : "SELF";
  const providedVerificationPassword =
    verificationMode === "PASSWORD" ? normalizeBasic(body.verificationPassword) : "";
  const generatedVerificationPassword =
    verificationMode === "PASSWORD" && !providedVerificationPassword ? generateReadablePassword() : null;
  const verificationPassword = generatedVerificationPassword ?? providedVerificationPassword;
  if (verificationMode === "PASSWORD" && verificationPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_verification_password" }, { status: 400 });
  }

  const expiresAt = new Date(normalizeBasic(body.expiresAt));
  if (Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid_expires_at" }, { status: 400 });
  }
  expiresAt.setHours(23, 59, 59, 999);
  if (expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expires_in_past" }, { status: 400 });
  }

  const title = normalizeBasic(body.title) || "Registrierungsformular";
  const token = createRegistrationToken();

  const inserted = await db
    .insert(memberRegistrationForms)
    .values({
      token,
      title,
      userLimit,
      role,
      verificationMode,
      passwordMode,
      verificationPasswordHash: verificationMode === "PASSWORD" ? hashVerificationPassword(verificationPassword) : null,
      verificationPasswordSecret: verificationMode === "PASSWORD" ? encryptSecret(verificationPassword) : null,
      expiresAt,
      createdById: viewer.id,
    })
    .returning({ id: memberRegistrationForms.id });

  return NextResponse.json({
    ok: true,
    id: inserted.at(0)?.id ?? null,
    link: linkForToken(token, request),
    verificationPassword: verificationMode === "PASSWORD" ? verificationPassword : "",
    generatedVerificationPassword,
  });
}
