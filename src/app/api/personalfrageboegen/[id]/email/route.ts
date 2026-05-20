import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { sendCustomEmail } from "@/lib/custom-email";
import { renderPersonalfragebogenHonorarPdf } from "@/lib/personalfrageboegen-pdf";
import { getDataDir } from "@/lib/data-dir";
import { isSftpEnabled, withSftp } from "@/lib/sftp";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

function norm(v: unknown, max = 5000) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function isProbablyEmail(value: string) {
  if (value.length < 6 || value.length > 254) return false;
  if (!value.includes("@")) return false;
  if (/\s/.test(value)) return false;
  return true;
}

async function loadQuestionnaireFileBytes(file: {
  storageKey: string;
}): Promise<Uint8Array> {
  const storageKey = String(file.storageKey || "").replaceAll("\\", "/");
  if (!storageKey || storageKey.includes("..") || storageKey.startsWith("/")) {
    throw new Error("invalid_storage_key");
  }

  const sftpOn = await isSftpEnabled();
  if (sftpOn) {
    const res = await withSftp(async (client, basePath) => {
      const remoteFile = path.posix.join(basePath, storageKey);
      const data = (await client.get(remoteFile)) as unknown;
      if (Buffer.isBuffer(data)) return data;
      if (data instanceof Uint8Array) return Buffer.from(data);
      if (typeof data === "string") return Buffer.from(data);
      throw new Error("sftp_download_failed");
    });
    if (!res) throw new Error("sftp_not_available");
    return Uint8Array.from(res);
  }

  // legacy questionnaire uploads were stored under `data/Personalfrageboegen/...`
  // once a user is created, files are moved into `data/uploads/<userId>/...` and storageKey becomes `<userId>/<name>`
  const parts = storageKey.split("/").filter(Boolean);
  const looksLikeUserUpload = parts.length >= 2 && /^[0-9]+$/.test(parts[0] ?? "");
  const diskPath = looksLikeUserUpload
    ? path.join(getDataDir(), "uploads", parts[0]!, parts.slice(1).join("/"))
    : path.join(getDataDir(), storageKey);
  const bytes = await readFile(diskPath);
  return Uint8Array.from(bytes);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const questionnaireId = Number(id);
  if (!Number.isFinite(questionnaireId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Partial<{
    to: string;
    subject: string;
    message: string;
    includePdf: boolean;
    fileIds: number[];
  }>;
  const subject = norm(body.subject, 180) || "MILODO – Nachricht";
  const message = norm(body.message, 5000);
  const includePdf = Boolean(body.includePdf);
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map((n) => Number(n)).filter(Number.isFinite) : [];

  if (!message) return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 });
  if (!includePdf && !fileIds.length) {
    return NextResponse.json({ ok: false, error: "missing_attachment" }, { status: 400 });
  }

  let row: any = null;
  try {
    row = await db.query.personalQuestionnaires.findFirst({
      where: (t, { eq }) => eq(t.id, questionnaireId),
      with: { files: true },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("no such table")) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    throw e;
  }

  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const to = norm(body.to, 254) || String(row.email || "").trim();
  if (!to) return NextResponse.json({ ok: false, error: "no_email" }, { status: 400 });
  if (!isProbablyEmail(to)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });

  try {
    const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];

    if (includePdf) {
      if (String(row.kind || "") !== "HONORAR") {
        return NextResponse.json({ ok: false, error: "pdf_not_available" }, { status: 409 });
      }
      const uploadedCount = Array.isArray(row.files) ? row.files.length : 0;
      const bytes = await renderPersonalfragebogenHonorarPdf({
        questionnaire: {
          id: row.id,
          createdAt: row.createdAt ?? null,
          firstName: row.firstName ?? "",
          lastName: row.lastName ?? "",
          geb: row.geb ?? null,
          taxNumber: row.taxNumber ?? "",
          street: row.street ?? "",
          houseNumber: row.houseNumber ?? "",
          plz: row.plz ?? "",
          city: row.city ?? "",
          cityExtra: row.cityExtra ?? "",
          phone: row.phone ?? "",
          phoneShare: Boolean(row.phoneShare),
          email: row.email ?? "",
          bankAccountHolder: row.bankAccountHolder ?? "",
          bankAccountHolderDiffers: Boolean(row.bankAccountHolderDiffers),
          bankName: row.bankName ?? "",
          iban: row.iban ?? "",
          blz: row.blz ?? "",
          einsatzfelderJson: row.einsatzfelderJson ?? "[]",
          qualMed: row.qualMed ?? null,
          qualEhAusbilder: Boolean(row.qualEhAusbilder),
          sizesJson: row.sizesJson ?? "{}",
          hasNeutralPsa: Boolean(row.hasNeutralPsa),
          driverLicencesJson: row.driverLicencesJson ?? "[]",
          hasPss: Boolean(row.hasPss),
          ownCar: Boolean(row.ownCar),
          contactPrefsJson: row.contactPrefsJson ?? "[]",
        },
        uploadedCount,
      });
      const fileName = `Personalfragebogen-Honorar-${row.lastName || "Person"}-${row.id}.pdf`;
      attachments.push({ filename: fileName, content: Buffer.from(bytes), contentType: "application/pdf" });
    }

    if (fileIds.length) {
      const uniqueIds = Array.from(new Set(fileIds)).slice(0, 10);
      const files = await db.query.personalQuestionnaireFiles.findMany({
        where: (t, { and, eq, inArray }) => and(eq(t.questionnaireId, questionnaireId), inArray(t.id, uniqueIds)),
      });
      const found = new Set(files.map((f) => f.id));
      for (const id of uniqueIds) {
        if (!found.has(id)) return NextResponse.json({ ok: false, error: "file_not_found" }, { status: 404 });
      }

      for (const f of files) {
        const bytes = await loadQuestionnaireFileBytes({ storageKey: f.storageKey });
        attachments.push({
          filename: f.originalName || f.fileName,
          content: Buffer.from(bytes),
          contentType: f.mimeType ?? "application/octet-stream",
        });
      }
    }

    const res = await sendCustomEmail({ to, subject, message, attachments });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    return NextResponse.json({ ok: false, error: "send_failed", message: msg }, { status: 500 });
  }
}
