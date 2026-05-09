import crypto from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { isSftpEnabled, withSftp } from "@/lib/sftp";

function safeDirName(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll(/[^a-z0-9\-_/ ]/g, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/\/+/g, "/")
    .replaceAll(/^\/+|\/+$/g, "")
    .slice(0, 80);
}

function safeFileName(name: string) {
  return String(name || "upload.bin")
    .replaceAll(/[^\w.\- ()]/g, "_")
    .replaceAll(/_+/g, "_")
    .slice(0, 160);
}

export function blogCategoryKey(category: string) {
  return safeDirName(category) || "allgemein";
}

export function blogPostFolderKey(category: string, postId: number) {
  const cat = blogCategoryKey(category);
  return path.posix.join("blog", cat, String(postId));
}

export function blogUploadsFolderKey() {
  return path.posix.join("blog", "uploads");
}

export function blogAssetStorageKey(category: string, postId: number, storedName: string) {
  return path.posix.join(blogPostFolderKey(category, postId), storedName);
}

export function blogUploadStorageKey(storedName: string) {
  return path.posix.join(blogUploadsFolderKey(), storedName);
}

export async function storeBlogAsset({
  file,
}: {
  file: File;
}) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const sizeBytes = bytes.byteLength;
  if (sizeBytes > 25 * 1024 * 1024) throw new Error("file_too_large");

  const uuid = crypto.randomUUID();
  const cleaned = safeFileName(file.name || "upload.bin");
  const storedName = `${uuid}-${cleaned}`;
  const storageKey = blogUploadStorageKey(storedName);

  const sftpOn = await isSftpEnabled();
  if (sftpOn) {
    const res = await withSftp(async (client, basePath) => {
      const remoteDir = path.posix.join(basePath, blogUploadsFolderKey());
      await client.mkdir(remoteDir, true);
      await client.put(bytes, path.posix.join(remoteDir, storedName));
      return true;
    });
    if (!res) throw new Error("sftp_not_available");
  } else {
    const diskPath = path.join(process.cwd(), "data", storageKey);
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, bytes);
  }

  return { storageKey, storedName, sizeBytes, mimeType: file.type || null };
}

export async function writeBlogExport({
  category,
  postId,
  slug,
  title,
  excerpt,
  contentMd,
  titleImageKey,
  publishedAt,
}: {
  category: string;
  postId: number;
  slug: string;
  title: string;
  excerpt: string;
  contentMd: string;
  titleImageKey: string;
  publishedAt: Date;
}) {
  const cat = blogCategoryKey(category);
  const baseDir = path.posix.join("blog", cat, String(postId));
  const meta = {
    id: postId,
    slug,
    title,
    category: cat,
    excerpt,
    titleImageKey: titleImageKey || "",
    publishedAt: publishedAt.toISOString(),
  };

  const sftpOn = await isSftpEnabled();
  if (sftpOn) {
    const res = await withSftp(async (client, basePath) => {
      const remoteDir = path.posix.join(basePath, baseDir);
      await client.mkdir(remoteDir, true);
      await client.put(Buffer.from(JSON.stringify(meta, null, 2), "utf8"), path.posix.join(remoteDir, "post.json"));
      await client.put(Buffer.from(contentMd || "", "utf8"), path.posix.join(remoteDir, "content.md"));
      return true;
    });
    if (!res) throw new Error("sftp_not_available");
  } else {
    const diskDir = path.join(process.cwd(), "data", baseDir);
    await mkdir(diskDir, { recursive: true });
    await writeFile(path.join(diskDir, "post.json"), JSON.stringify(meta, null, 2), "utf8");
    await writeFile(path.join(diskDir, "content.md"), contentMd || "", "utf8");
  }

  return { baseDir };
}
