import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { isSftpEnabled, withSftp } from "@/lib/sftp";
import { getDataDir } from "@/lib/data-dir";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const key = String(url.searchParams.get("key") ?? "").replaceAll("\\", "/");
  if (!key || key.includes("..") || key.startsWith("/")) return NextResponse.json({ ok: false, error: "invalid_key" }, { status: 400 });
  if (!key.startsWith("blog/")) return NextResponse.json({ ok: false, error: "invalid_key" }, { status: 400 });

  const sftpOn = await isSftpEnabled();
  let bytes: Uint8Array;
  if (sftpOn) {
    const res = await withSftp(async (client, basePath) => {
      const remoteFile = path.posix.join(basePath, key);
      const data = (await client.get(remoteFile)) as unknown;
      if (Buffer.isBuffer(data)) return data;
      if (data instanceof Uint8Array) return Buffer.from(data);
      if (typeof data === "string") return Buffer.from(data);
      throw new Error("sftp_download_failed");
    });
    if (!res) return NextResponse.json({ ok: false, error: "sftp_not_available" }, { status: 500 });
    bytes = res;
  } else {
    const diskPath = path.join(getDataDir(), key);
    bytes = await readFile(diskPath);
  }

  return new Response(Uint8Array.from(bytes).buffer, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store, max-age=0",
    },
  });
}
