import { NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { db } from "@/lib/db";
import { documents } from "@/db/schema";
import { buildUserRemoteDir, buildUserRemoteFilePath, isSftpEnabled, withSftp } from "@/lib/sftp";
import { getViewer } from "@/lib/viewer";
import { getDataDir } from "@/lib/data-dir";

type Category = "CV" | "TRAINING" | "CONTRACT";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

function safeFileName(name: string) {
  return name.replaceAll(/[^\w.\- ()]/g, "_").slice(0, 160);
}

function splitExt(name: string) {
  const ext = path.extname(name || "").slice(0, 10);
  const base = (name || "").slice(0, Math.max(0, name.length - ext.length));
  return { base, ext };
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const form = await request.formData();
  const ownerId = Number(form.get("ownerId"));
  const category = String(form.get("category") ?? "") as Category;
  const title = String(form.get("title") ?? "").trim();
  const keepFileName = String(form.get("keepFileName") ?? "1") !== "0";
  const file = form.get("file");

  if (!Number.isFinite(ownerId)) {
    return NextResponse.json({ ok: false, error: "invalid_owner" }, { status: 400 });
  }

  // title can be empty; in that case we use file name as title.
  const effectiveTitle = title || "";

  if (category !== "CV" && category !== "TRAINING" && category !== "CONTRACT") {
    return NextResponse.json({ ok: false, error: "invalid_category" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  const canUpload = isAdminOrVerwaltung(viewer.role) || viewer.id === ownerId;
  if (!canUpload) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const owner = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, ownerId) });
  if (!owner) return NextResponse.json({ ok: false, error: "owner_not_found" }, { status: 404 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const sizeBytes = bytes.byteLength;

  // 25MB basic guard
  if (sizeBytes > 25 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 413 });
  }

  const docUuid = crypto.randomUUID();
  const originalName = safeFileName(file.name || "upload.bin");
  const { base: origBase, ext: origExt } = splitExt(originalName);
  const ext = origExt || ".bin";

  const desiredBase = safeFileName(effectiveTitle || origBase || "upload");
  const desiredFileName = `${desiredBase}${ext}`;
  const finalFileName = keepFileName ? originalName : desiredFileName;

  const sftpOn = await isSftpEnabled();
  let storageKey = "";
  if (sftpOn) {
    try {
      const result = await withSftp(async (client, basePath) => {
        const userDir = buildUserRemoteDir(basePath, owner.username);
        await client.mkdir(userDir, true);
        const remoteFile = buildUserRemoteFilePath(basePath, owner.username, finalFileName);
        const exists = await client.exists(remoteFile);
        if (exists) {
          const base = keepFileName ? safeFileName(origBase || "upload") : desiredBase;
          const alt = `${base}-${docUuid.slice(0, 8)}${ext}`;
          await client.put(bytes, buildUserRemoteFilePath(basePath, owner.username, alt));
          return { storedName: alt };
        }
        await client.put(bytes, remoteFile);
        return { storedName: finalFileName };
      });
      const name = result?.storedName || finalFileName;
      storageKey = `${owner.username}/${name}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sftp_failed";
      return NextResponse.json({ ok: false, error: "sftp_failed", message: msg }, { status: 500 });
    }
  } else {
    const dir = path.join(getDataDir(), "uploads", String(ownerId));
    await mkdir(dir, { recursive: true });
    const diskName = `${docUuid}${ext}`;
    const diskPath = path.join(dir, diskName);
    await writeFile(diskPath, bytes);
    storageKey = `${ownerId}/${diskName}`;
  }

  const mimeType = file.type || null;

  const inserted = await db
    .insert(documents)
    .values({
      ownerId,
      title: effectiveTitle || origBase || originalName,
      category,
      fileName: finalFileName,
      mimeType,
      storageKey,
      sizeBytes,
    })
    .returning({ id: documents.id });

  return NextResponse.json({ ok: true, id: inserted.at(0)?.id ?? null });
}
