import { NextResponse } from "next/server";
import dns from "node:dns/promises";

import { getViewer } from "@/lib/viewer";
import { createSmtpTransporter, getSmtpConfig } from "@/lib/smtp-mail";

export const runtime = "nodejs";

function emailDomain(email: string) {
  return email.split("@").at(1)?.trim().toLowerCase() || "";
}

async function resolveTxtFlat(name: string) {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((parts) => parts.join(""));
  } catch {
    return [];
  }
}

async function buildMailAuthDiagnostics(fromEmail: string) {
  const domain = emailDomain(fromEmail);
  if (!domain) {
    return {
      domain: "",
      spf: false,
      dmarc: false,
      dkimEnvConfigured: false,
      notes: ["From E-Mail hat keine gültige Domain."],
    };
  }

  const [txt, dmarcTxt] = await Promise.all([
    resolveTxtFlat(domain),
    resolveTxtFlat(`_dmarc.${domain}`),
  ]);

  const spf = txt.some((record) => record.toLowerCase().startsWith("v=spf1"));
  const dmarc = dmarcTxt.some((record) => record.toLowerCase().startsWith("v=dmarc1"));
  const dkimEnvConfigured = Boolean(
    String(process.env.SMTP_DKIM_DOMAIN ?? "").trim() &&
      String(process.env.SMTP_DKIM_SELECTOR ?? "").trim() &&
      String(process.env.SMTP_DKIM_PRIVATE_KEY ?? "").trim(),
  );

  const notes: string[] = [];
  if (!spf) notes.push(`Kein SPF TXT Record für ${domain} gefunden.`);
  if (!dmarc) notes.push(`Kein DMARC TXT Record für _dmarc.${domain} gefunden.`);
  if (!dkimEnvConfigured) {
    notes.push("DKIM ist in der App nicht konfiguriert. Outlook/GMX stufen Mails ohne DKIM oft strenger ein.");
  }

  return { domain, spf, dmarc, dkimEnvConfigured, notes };
}

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const smtp = await getSmtpConfig();
  if (!smtp.ok) return NextResponse.json({ ok: false, error: smtp.error }, { status: 400 });
  const diagnostics = await buildMailAuthDiagnostics(smtp.config.fromEmail);

  try {
    const transporter = createSmtpTransporter(smtp.config);
    await transporter.verify();
    return NextResponse.json({ ok: true, diagnostics });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMTP verify failed";
    return NextResponse.json({ ok: false, error: "verify_failed", message: msg, diagnostics }, { status: 400 });
  }
}
