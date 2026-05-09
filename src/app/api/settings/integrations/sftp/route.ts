import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { sftpSettings, users } from "@/db/schema";
import { buildUserRemoteDir, withSftp } from "@/lib/sftp";
import { getViewer } from "@/lib/viewer";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/secrets";

export const runtime = "nodejs";

async function ensureRow() {
  await db
    .insert(sftpSettings)
    .values({ id: 1 })
    .onConflictDoNothing();
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  await ensureRow();
  const row = await db.query.sftpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({
    ok: true,
    sftp: {
      enabled: row.enabled,
      host: row.host,
      port: row.port,
      username: row.username,
      password: decryptSecret(row.password),
      passwordEncrypted: isEncrypted(row.password),
      remotePath: row.remotePath,
    },
  });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  await ensureRow();

  const body = (await request.json()) as Partial<{
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    remotePath: string;
  }>;

  const update: Partial<typeof sftpSettings.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.host === "string") update.host = body.host.trim();
  if (typeof body.username === "string") update.username = body.username.trim();
  if (typeof body.password === "string") {
    const next = body.password;
    update.password = next ? encryptSecret(next) : "";
  }
  if (typeof body.remotePath === "string") update.remotePath = body.remotePath.trim() || "/";
  if (typeof body.port === "number" && Number.isFinite(body.port)) {
    update.port = Math.max(1, Math.min(65535, Math.round(body.port)));
  }

  await db.update(sftpSettings).set(update).where(eq(sftpSettings.id, 1));

  // When enabled, pre-create per-user directories in the configured root.
  if (update.enabled === true) {
    try {
      const all = await db.select({ username: users.username }).from(users).orderBy(users.username);
      await withSftp(async (client, basePath) => {
        for (const u of all) {
          await client.mkdir(buildUserRemoteDir(basePath, u.username), true);
        }
        return true;
      });
    } catch {
      // ignore: upload will surface concrete errors
    }
  }
  return NextResponse.json({ ok: true });
}
