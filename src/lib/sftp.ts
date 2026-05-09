import SftpClient from "ssh2-sftp-client";
import path from "node:path";

import { db } from "@/lib/db";
import { sftpSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";

function safeRemoteDirName(name: string) {
  const cleaned = String(name || "")
    .trim()
    .replaceAll(/[^\w\-]/g, "_")
    .replaceAll(/_+/g, "_")
    .slice(0, 64);
  return cleaned || "user";
}

function normalizeRemotePath(p: string) {
  const trimmed = (p || "/").trim() || "/";
  const withSlashes = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlashes.replaceAll(/\/+/g, "/");
}

async function ensureRow() {
  await db.insert(sftpSettings).values({ id: 1 }).onConflictDoNothing();
}

export async function isSftpEnabled() {
  await ensureRow();
  const row = await db.query.sftpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  return Boolean(row?.enabled);
}

export async function withSftp<T>(fn: (client: SftpClient, basePath: string) => Promise<T>): Promise<T | null> {
  await ensureRow();
  const row = await db.query.sftpSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  if (!row?.enabled) return null;

  if (!row.host || !row.username) throw new Error("SFTP not configured");

  const client = new SftpClient();
  try {
    await client.connect({
      host: row.host,
      port: row.port ?? 22,
      username: row.username,
      password: decryptSecret(row.password) || undefined,
      readyTimeout: 15_000,
    });

    const basePath = normalizeRemotePath(row.remotePath || "/");
    await client.mkdir(basePath, true);

    return await fn(client, basePath);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

export function buildUserRemoteDir(basePath: string, ownerKey: string) {
  return path.posix.join(basePath, safeRemoteDirName(ownerKey));
}

export function buildUserRemoteFilePath(basePath: string, ownerKey: string, storedName: string) {
  return path.posix.join(buildUserRemoteDir(basePath, ownerKey), storedName);
}

export function buildServicesDir(basePath: string) {
  return path.posix.join(basePath, "Dienste");
}

export function buildServiceRemoteFilePath(basePath: string, storedName: string) {
  return path.posix.join(buildServicesDir(basePath), storedName);
}
