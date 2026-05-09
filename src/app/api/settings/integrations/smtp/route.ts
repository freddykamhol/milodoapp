import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { smtpSettings } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/secrets";

export const runtime = "nodejs";

async function ensureRow() {
  await db
    .insert(smtpSettings)
    .values({ id: 1 })
    .onConflictDoNothing();
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  await ensureRow();
  const row = await db.query.smtpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({
    ok: true,
    smtp: {
      enabled: row.enabled,
      host: row.host,
      port: row.port,
      username: row.username,
      password: decryptSecret(row.password),
      passwordEncrypted: isEncrypted(row.password),
      fromEmail: row.fromEmail,
      secure: row.secure,
    },
  });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  await ensureRow();

  const body = (await request.json()) as Partial<{
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
    secure: boolean;
  }>;

  const update: Partial<typeof smtpSettings.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.secure === "boolean") update.secure = body.secure;
  if (typeof body.host === "string") update.host = body.host.trim();
  if (typeof body.username === "string") update.username = body.username.trim();
  if (typeof body.password === "string") {
    const next = body.password;
    update.password = next ? encryptSecret(next) : "";
  }
  if (typeof body.fromEmail === "string") update.fromEmail = body.fromEmail.trim();
  if (typeof body.port === "number" && Number.isFinite(body.port)) {
    update.port = Math.max(1, Math.min(65535, Math.round(body.port)));
  }

  await db.update(smtpSettings).set(update).where(eq(smtpSettings.id, 1));
  return NextResponse.json({ ok: true });
}
