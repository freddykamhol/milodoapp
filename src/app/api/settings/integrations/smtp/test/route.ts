import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { db } from "@/lib/db";
import { smtpSettings } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

async function ensureRow() {
  await db.insert(smtpSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  await ensureRow();
  const row = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row) return NextResponse.json({ ok: false }, { status: 500 });
  if (!row.enabled) return NextResponse.json({ ok: false, error: "disabled" }, { status: 400 });

  if (!row.host || !row.port) return NextResponse.json({ ok: false, error: "missing_config" }, { status: 400 });

  try {
    const transporter = nodemailer.createTransport({
      host: row.host,
      port: row.port,
      secure: Boolean(row.secure),
      auth: row.username ? { user: row.username, pass: decryptSecret(row.password) } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });

    await transporter.verify();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMTP verify failed";
    return NextResponse.json({ ok: false, error: "verify_failed", message: msg }, { status: 400 });
  }
}
