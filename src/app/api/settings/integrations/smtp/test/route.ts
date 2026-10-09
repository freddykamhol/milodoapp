import { NextResponse } from "next/server";
import dns from "node:dns/promises";

import { getViewer } from "@/lib/viewer";
import { getSmtpConfig, sendSmtpMail } from "@/lib/smtp-mail";

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

async function hasDkimDnsRecord(name: string) {
  const [cnames, txt] = await Promise.all([
    dns.resolveCname(name).catch(() => [] as string[]),
    resolveTxtFlat(name),
  ]);
  return cnames.length > 0 || txt.some((record) => record.toLowerCase().startsWith("v=dkim1"));
}

async function buildMailAuthDiagnostics(fromEmail: string) {
  const domain = emailDomain(fromEmail);
  if (!domain) {
    return {
      domain: "",
      spf: false,
      dmarc: false,
      dkimEnvConfigured: false,
      dkimDnsConfigured: false,
      dkimDnsSelectors: [],
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
  const envSelector = String(process.env.SMTP_DKIM_SELECTOR ?? "").trim();
  const selectors = [...new Set([envSelector, "key1", "key2"].filter(Boolean))];
  const selectorResults = await Promise.all(
    selectors.map(async (selector) => ({
      selector,
      configured: await hasDkimDnsRecord(`${selector}._domainkey.${domain}`),
    })),
  );
  const dkimDnsSelectors = selectorResults.filter((result) => result.configured).map((result) => result.selector);
  const dkimDnsConfigured = dkimDnsSelectors.length > 0;

  const notes: string[] = [];
  if (!spf) notes.push(`Kein SPF TXT Record für ${domain} gefunden.`);
  if (!dmarc) notes.push(`Kein DMARC TXT Record für _dmarc.${domain} gefunden.`);
  if (!dkimEnvConfigured && !dkimDnsConfigured) {
    notes.push("Kein DKIM-Schlüssel in der App und kein DKIM-DNS-Eintrag gefunden.");
  }

  return { domain, spf, dmarc, dkimEnvConfigured, dkimDnsConfigured, dkimDnsSelectors, notes };
}

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const smtp = await getSmtpConfig();
  if (!smtp.ok) return NextResponse.json({ ok: false, error: smtp.error }, { status: 400 });
  if (!viewer.email?.trim()) {
    return NextResponse.json(
      { ok: false, error: "viewer_email_missing", message: "Im eigenen Profil ist keine Test-E-Mail-Adresse hinterlegt." },
      { status: 400 },
    );
  }
  const diagnostics = await buildMailAuthDiagnostics(smtp.config.fromEmail);

  try {
    const result = await sendSmtpMail({
      to: viewer.email.trim(),
      subject: "[Milodo] SMTP-Zustellungstest",
      text: "Diese Nachricht bestätigt, dass der Milodo SMTP-Versand vom Mailserver angenommen wurde.",
      html: "<p>Diese Nachricht bestätigt, dass der <strong>Milodo SMTP-Versand</strong> vom Mailserver angenommen wurde.</p>",
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, message: "Der SMTP-Server hat die Testnachricht nicht angenommen.", diagnostics },
        { status: 400 },
      );
    }
    const warning = diagnostics.notes.length ? ` Hinweise: ${diagnostics.notes.join(" ")}` : "";
    return NextResponse.json({
      ok: true,
      diagnostics,
      message: `Testmail wurde vom SMTP-Server für ${viewer.email.trim()} angenommen.${warning}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMTP verify failed";
    return NextResponse.json({ ok: false, error: "verify_failed", message: msg, diagnostics }, { status: 400 });
  }
}
