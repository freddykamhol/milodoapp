import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { db } from "@/lib/db";
import { personalQuestionnaireFiles } from "@/db/schema";
import { isSftpEnabled, withSftp } from "@/lib/sftp";
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
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isFinite(fileId)) return NextResponse.json({ ok: false }, { status: 400 });

  const file = await db.query.personalQuestionnaireFiles.findFirst({
    where: (t, { eq }) => eq(t.id, fileId),
  });
  if (!file) return NextResponse.json({ ok: false }, { status: 404 });

  const storageKey = String(file.storageKey || "").replaceAll("\\", "/");
  if (!storageKey || storageKey.includes("..") || storageKey.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "invalid_storage_key" }, { status: 400 });
  }

  const sftpOn = await isSftpEnabled();
  let bytes: Uint8Array;
  if (sftpOn) {
    try {
      const res = await withSftp(async (client, basePath) => {
        const remoteFile = path.posix.join(basePath, storageKey);
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
      if (msg.includes("No such file") || msg.includes("not exist") || msg.includes("not found")) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({ ok: false, error: "sftp_failed", message: msg }, { status: 500 });
    }
  } else {
    // legacy questionnaire uploads were stored under `data/Personalfrageboegen/...`
    // once a user is created, files are moved into `data/uploads/<userId>/...` and storageKey becomes `<userId>/<name>`
    const parts = storageKey.split("/").filter(Boolean);
    const looksLikeUserUpload = parts.length >= 2 && /^[0-9]+$/.test(parts[0] ?? "");
    const diskPath = looksLikeUserUpload
      ? path.join(process.cwd(), "data", "uploads", parts[0]!, parts.slice(1).join("/"))
      : path.join(process.cwd(), "data", storageKey);
    bytes = await readFile(diskPath);
  }

  const downloadName = file.originalName || file.fileName;
  const body = Uint8Array.from(bytes).buffer;
  return new Response(body, {
    headers: {
      "content-type": file.mimeType ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${encodeURIComponent(downloadName)}"`,
      "cache-control": "no-store, max-age=0",
    },
  });
}
