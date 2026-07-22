import { NextResponse } from "next/server";

import {
  createRegisteredMember,
  findActiveRegistrationForm,
  verifyRegistrationPassword,
  type MemberRegistrationPayload,
} from "@/lib/member-registration";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { form, used, reason } = await findActiveRegistrationForm(token);

  if (!form) return NextResponse.json({ ok: false, error: reason }, { status: 404 });
  if (reason) return NextResponse.json({ ok: false, error: reason }, { status: 400 });

  return NextResponse.json({
    ok: true,
    form: {
      title: form.title,
      role: form.role,
      verificationMode: form.verificationMode,
      requiresVerificationPassword: Boolean(form.verificationPasswordHash),
      passwordMode: form.passwordMode,
      expiresAt: form.expiresAt.toISOString(),
      userLimit: form.userLimit,
      used,
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { form, reason } = await findActiveRegistrationForm(token);

  if (!form) return NextResponse.json({ ok: false, error: reason }, { status: 404 });
  if (reason) return NextResponse.json({ ok: false, error: reason }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Partial<MemberRegistrationPayload> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  if (
    form.verificationMode === "PASSWORD" &&
    Boolean(form.verificationPasswordHash) &&
    !verifyRegistrationPassword(String(body.verificationPassword ?? ""), form.verificationPasswordHash)
  ) {
    return NextResponse.json({ ok: false, error: "invalid_verification_password" }, { status: 400 });
  }

  const result = await createRegisteredMember({
    formId: form.id,
    payload: body as MemberRegistrationPayload,
    role: form.role,
    verificationMode: form.verificationMode,
    password: String(body.password ?? ""),
  });

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    username: result.username,
    pendingApproval: form.verificationMode === "ADMIN",
  });
}
