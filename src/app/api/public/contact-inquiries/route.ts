import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { contactInquiries } from "@/db/schema";
import { sendContactInquiryEmail } from "@/lib/contact-inquiry-email";
import { ensureContactInquiriesTable } from "@/lib/contact-inquiries";
import { isIpBlocked } from "@/lib/ip-blocklist";

export const runtime = "nodejs";

function allowedOrigins(): string[] {
  const raw = String(process.env.CONTACT_INQUIRY_ALLOWED_ORIGINS ?? "").trim();
  const fallback =
    process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"];
  const list = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : fallback;
  return Array.from(new Set(list));
}

function corsHeaders(origin: string | null) {
  const allow = allowedOrigins();
  const matched = origin && allow.includes(origin) ? origin : null;
  return {
    "access-control-allow-origin": matched ?? "null",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "origin",
  } as const;
}

function json(status: number, body: unknown, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

type Payload = {
  website?: string; // honeypot
  mode?: unknown;
  name?: unknown;
  company?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
  details?: unknown;
  privacyConsent?: unknown;
  sourceUrl?: unknown;
  recaptchaToken?: unknown;
  recaptchaAction?: unknown;
};

function norm(v: unknown, max = 4000) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function asBool(v: unknown) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function requestIp(request: Request): string {
  const xfwd = String(request.headers.get("x-forwarded-for") ?? "").trim();
  if (xfwd) return xfwd.split(",")[0]!.trim();
  const real = String(request.headers.get("x-real-ip") ?? "").trim();
  if (real) return real;
  const cf = String(request.headers.get("cf-connecting-ip") ?? "").trim();
  if (cf) return cf;
  return "";
}

async function verifyRecaptcha(token: string, action: string): Promise<{ ok: boolean; scoreBp: number | null }> {
  const secret = String(process.env.RECAPTCHA_SECRET_KEY ?? "").trim();
  if (!secret) return { ok: true, scoreBp: null }; // allow if not configured
  const t = String(token ?? "").trim();
  if (!t) return { ok: false, scoreBp: null };

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", t);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; score?: number; action?: string }
    | null;
  const ok = Boolean(json?.success);
  const score = typeof json?.score === "number" ? json.score : null;
  const scoreBp = score === null ? null : Math.max(0, Math.min(1000, Math.round(score * 1000)));
  if (!ok) return { ok: false, scoreBp };
  if (action && json?.action && String(json.action) !== action) return { ok: false, scoreBp };

  const min = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.3");
  if (score !== null && Number.isFinite(min) && score < min) return { ok: false, scoreBp };
  return { ok: true, scoreBp };
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allow = allowedOrigins();
  if (process.env.NODE_ENV === "production") {
    if (!origin || !allow.includes(origin)) return json(403, { ok: false, error: "forbidden_origin" }, origin);
  }

  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body) return json(400, { ok: false, error: "invalid_json" }, origin);

  // Bot trap
  if (norm(body.website, 200)) return json(200, { ok: true }, origin);

  const mode = norm(body.mode, 32) || "kontakt";
  const name = norm(body.name, 120);
  const company = norm(body.company, 180);
  const email = norm(body.email, 180).toLowerCase();
  const phone = norm(body.phone, 80);
  const message = norm(body.message, 6000);
  const privacyConsent = asBool(body.privacyConsent);
  const sourceUrl = norm(body.sourceUrl, 800);
  const detailsJson = JSON.stringify(body.details ?? {});

  if (!privacyConsent) return json(400, { ok: false, error: "privacy_consent_required" }, origin);
  if (!name || !email) return json(400, { ok: false, error: "missing_required" }, origin);

  ensureContactInquiriesTable();

  const ip = requestIp(request);
  if (ip && isIpBlocked(ip)) return json(403, { ok: false, error: "ip_blocked" }, origin);

  const recaptchaToken = norm(body.recaptchaToken, 8000);
  const recaptchaAction = norm(body.recaptchaAction, 64);
  const recaptcha = await verifyRecaptcha(recaptchaToken, recaptchaAction);
  if (!recaptcha.ok) return json(400, { ok: false, error: "recaptcha_failed" }, origin);

  const now = new Date();
  const inserted = await db
    .insert(contactInquiries)
    .values({
      createdAt: now,
      updatedAt: now,
      readAt: null,
      deletedAt: null,
      status: "NEW",
      source: "website",
      sourceUrl,
      ip,
      userAgent: String(request.headers.get("user-agent") ?? "").slice(0, 600),
      mode,
      name,
      company,
      email,
      phone,
      message,
      detailsJson,
      privacyConsent: true,
      privacyConsentAt: now,
      recaptchaScoreBp: recaptcha.scoreBp,
      recaptchaAction,
    })
    .returning({ id: contactInquiries.id });

  const id = inserted?.[0]?.id ?? null;

  const subject = `[Website] Kontaktanfrage #${id ?? "?"} (${mode})`;
  const emailRes = await sendContactInquiryEmail({
    subject,
    preheader: `Neue Anfrage von ${name}`,
    sections: [
      { label: "Referenz", value: id ? `#${id}` : "-" },
      { label: "Typ", value: mode },
      { label: "Name", value: name },
      { label: "Firma", value: company || "-" },
      { label: "E‑Mail", value: email },
      { label: "Telefon", value: phone || "-" },
      { label: "Quelle", value: sourceUrl || "-" },
      { label: "Nachricht", value: message || "-" },
    ],
  });

  return json(200, { ok: true, id, email: emailRes.ok ? "sent" : emailRes.error }, origin);
}
