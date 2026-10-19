import path from "node:path";
import { readFile } from "node:fs/promises";

import { buildUserRemoteFilePath, isSftpEnabled, withSftp } from "@/lib/sftp";
import { getDataDir } from "@/lib/data-dir";

type StoredDocument = { storageKey: string | null; ownerId: number };

export async function readStoredDocument(document: StoredDocument): Promise<Buffer> {
  const storageKey = String(document.storageKey || "");
  const parts = storageKey.split("/").filter(Boolean);
  const storedName = parts.at(-1) || "";
  const ownerKey = parts[0] || String(document.ownerId);
  if (!storedName || storedName === "." || storedName === ".." || /[\\/]/.test(storedName)) {
    throw new Error("invalid_storage_key");
  }

  if (await isSftpEnabled()) {
    const result = await withSftp(async (client, basePath) => {
      const remoteFile = buildUserRemoteFilePath(basePath, ownerKey, storedName);
      const data = (await client.get(remoteFile)) as unknown;
      if (Buffer.isBuffer(data)) return data;
      if (data instanceof Uint8Array) return Buffer.from(data);
      if (typeof data === "string") return Buffer.from(data);
      throw new Error("document_download_failed");
    });
    if (!result) throw new Error("sftp_not_available");
    return result;
  }

  const ownerId = Number(ownerKey);
  if (!Number.isSafeInteger(ownerId) || ownerId < 1) throw new Error("invalid_owner");
  return readFile(path.join(getDataDir(), "uploads", String(ownerId), storedName));
}
