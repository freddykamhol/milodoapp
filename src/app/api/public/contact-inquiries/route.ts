import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { contactInquiries } from "@/db/schema";
import { sendContactInquiryEmail } from "@/lib/contact-inquiry-email";
import { ensureContactInquiriesTable } from "@/lib/contact-inquiries";

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
};

function norm(v: unknown, max = 4000) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function asBool(v: unknown) {
  return v === true || v === 1 || v === "1" || v === "true";
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

  const now = new Date();
  const inserted = await db
    .insert(contactInquiries)
    .values({
      createdAt: now,
      updatedAt: now,
      status: "NEW",
      source: "website",
      sourceUrl,
      mode,
      name,
      company,
      email,
      phone,
      message,
      detailsJson,
      privacyConsent: true,
      privacyConsentAt: now,
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
