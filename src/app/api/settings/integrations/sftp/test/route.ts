import { NextResponse } from "next/server";
import SftpClient from "ssh2-sftp-client";

import { db } from "@/lib/db";
import { sftpSettings } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

async function ensureRow() {
  await db.insert(sftpSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  await ensureRow();
  const row = await db.query.sftpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row) return NextResponse.json({ ok: false }, { status: 500 });
  if (!row.enabled) return NextResponse.json({ ok: false, error: "disabled" }, { status: 400 });
  if (!row.host || !row.username) return NextResponse.json({ ok: false, error: "missing_config" }, { status: 400 });

  const client = new SftpClient();
  try {
    await client.connect({
      host: row.host,
      port: row.port ?? 22,
      username: row.username,
      password: decryptSecret(row.password) || undefined,
      readyTimeout: 10_000,
    });

    const p = row.remotePath?.trim() || "/";
    const exists = await client.exists(p);
    if (!exists) {
      return NextResponse.json({ ok: false, error: "path_missing", message: `Remote-Pfad nicht gefunden: ${p}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SFTP connect failed";
    return NextResponse.json({ ok: false, error: "connect_failed", message: msg }, { status: 400 });
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}
