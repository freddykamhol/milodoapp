import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { db } from "@/lib/db";
import { buildUserRemoteFilePath, isSftpEnabled, withSftp } from "@/lib/sftp";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const { id } = await params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) return NextResponse.json({ ok: false }, { status: 400 });

  const doc = await db.query.documents.findFirst({ where: (t, { eq }) => eq(t.id, docId) });
  if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

  const canView = isAdminOrVerwaltung(viewer.role) || viewer.id === doc.ownerId;
  if (!canView) return NextResponse.json({ ok: false }, { status: 403 });

  const sftpOn = await isSftpEnabled();
  let bytes: Uint8Array;
  if (sftpOn) {
    try {
      const storageKey = String(doc.storageKey || "");
      const parts = storageKey.split("/");
      const storedName = parts.at(-1) || "";
      const ownerKey = parts[0] || "";
      if (!storedName || !ownerKey) throw new Error("invalid_storage_key");

      const res = await withSftp(async (client, basePath) => {
        const remoteFile = buildUserRemoteFilePath(basePath, ownerKey, storedName);
        const data = (await client.get(remoteFile)) as unknown;
        if (Buffer.isBuffer(data)) return data;
        if (data instanceof Uint8Array) return Buffer.from(data);
        if (typeof data === "string") return Buffer.from(data);
        throw new Error("sftp_download_failed");
      });
      if (!res) throw new Error("sftp_not_available");
      bytes = res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sftp_failed";
      // If the file is missing on SFTP, it must not be available in the system.
      if (msg.includes("No such file") || msg.includes("not exist") || msg.includes("not found")) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({ ok: false, error: "sftp_failed", message: msg }, { status: 500 });
    }
  } else {
    const parts = String(doc.storageKey || "").split("/");
    const storedName = parts.at(-1) || "";
    const ownerId = Number(parts[0] || doc.ownerId);
    const diskPath = path.join(process.cwd(), "data", "uploads", String(ownerId), storedName);
    bytes = await readFile(diskPath);
  }

  const body = Uint8Array.from(bytes).buffer;
  return new Response(body, {
    headers: {
      "content-type": doc.mimeType ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      "cache-control": "no-store, max-age=0",
    },
  });
}
