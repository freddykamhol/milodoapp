import { NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { documentExpiryPreferences, documents, users } from "@/db/schema";
import { buildUserRemoteDir, buildUserRemoteFilePath, isSftpEnabled, withSftp } from "@/lib/sftp";
import { getViewer } from "@/lib/viewer";
import { getDataDir } from "@/lib/data-dir";
import { calculateDocumentExpiry } from "@/lib/document-expiry";
import { sendNotificationEmail } from "@/lib/notification-email";

type Category = "CV" | "TRAINING" | "DRIVER_LICENSE" | "QUALIFICATION" | "CONTRACT";

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
  const manualExpiresAtValue = String(form.get("manualExpiresAt") ?? "").trim();
  const file = form.get("file");

  if (!Number.isFinite(ownerId)) {
    return NextResponse.json({ ok: false, error: "invalid_owner" }, { status: 400 });
  }

  // title can be empty; in that case we use file name as title.
  const effectiveTitle = title || "";

  if (!["CV", "TRAINING", "DRIVER_LICENSE", "QUALIFICATION", "CONTRACT"].includes(category)) {
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

  let manualExpiresAt: Date | null = null;
  if (manualExpiresAtValue) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(manualExpiresAtValue)) return NextResponse.json({ ok: false, error: "invalid_expiry_date" }, { status: 400 });
    const [year, month, day] = manualExpiresAtValue.split("-").map(Number);
    manualExpiresAt = new Date(Date.UTC(year, month - 1, day, 12));
    const todayInBerlin = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (manualExpiresAt.getUTCFullYear() !== year || manualExpiresAt.getUTCMonth() !== month - 1 || manualExpiresAt.getUTCDate() !== day || manualExpiresAtValue < todayInBerlin) {
      return NextResponse.json({ ok: false, error: "invalid_expiry_date" }, { status: 400 });
    }
  }
  await db.insert(documentExpiryPreferences).values({ id: 1 }).onConflictDoNothing();
  const expiryPreferences = await db.query.documentExpiryPreferences.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  const approvalPending = Boolean(manualExpiresAt && expiryPreferences?.manualExpiryRequiresApproval);
  const expiresAt = manualExpiresAt && !approvalPending ? manualExpiresAt : await calculateDocumentExpiry(category);

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
      expiresAt,
      requestedExpiresAt: approvalPending ? manualExpiresAt : null,
      expiryApprovalStatus: approvalPending ? "PENDING" : manualExpiresAt ? "APPROVED" : "NONE",
      fileName: finalFileName,
      mimeType,
      storageKey,
      sizeBytes,
    })
    .returning({ id: documents.id });

  if (approvalPending) {
    const managers = await db.select({ email: users.email }).from(users).where(eq(users.role, "VERWALTUNG"));
    const approvalUrl = new URL(`/documents/approvals/${inserted.at(0)?.id}`, request.url).toString();
    const managerEmails = managers.map((manager) => manager.email?.trim()).filter((email): email is string => Boolean(email));
    if (!managerEmails.length) console.warn("[document-expiry] no Verwaltung email address available for approval notification");
    const mailResults = await Promise.allSettled(managerEmails.map((email) => sendNotificationEmail({
      to: email,
      subject: `Manuelles Ablaufdatum genehmigen: ${effectiveTitle || origBase || originalName}`,
      preheader: "Genehmigung für ein Dokument erforderlich",
      title: "Ablaufdatum wartet auf Genehmigung",
      intro: `${viewer.username} hat für ein Dokument von ${owner.username} ein individuelles Ablaufdatum beantragt.`,
      sections: [
        { label: "Dokument", value: effectiveTitle || origBase || originalName },
        { label: "Beantragtes Ablaufdatum", value: manualExpiresAt!.toLocaleDateString("de-DE", { timeZone: "UTC" }) },
      ],
      button: { label: "Antrag prüfen", url: approvalUrl },
    })));
    for (const [index, result] of mailResults.entries()) {
      if (result.status === "rejected") console.error(`[document-expiry] approval mail failed for ${managerEmails[index]}`, result.reason);
      else if (!result.value.ok) console.error(`[document-expiry] approval mail was not sent to ${managerEmails[index]}`, result.value.reason);
    }
  }

  return NextResponse.json({ ok: true, id: inserted.at(0)?.id ?? null });
}
