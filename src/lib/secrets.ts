import crypto from "node:crypto";

const PREFIX = "enc:v1:";

function keyFromEnv(): Buffer | null {
  const raw = String(process.env.DATA_ENCRYPTION_KEY ?? "").trim();
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) return null;
    return buf;
  } catch {
    return null;
  }
}

export function encryptSecret(plain: string): string {
  const text = String(plain ?? "");
  if (!text) return "";
  const key = keyFromEnv();
  if (!key) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  const raw = String(value ?? "");
  if (!raw) return "";
  if (!raw.startsWith(PREFIX)) return raw;

  const key = keyFromEnv();
  if (!key) return "";

  const encoded = raw.slice(PREFIX.length);
  const [ivB64, dataB64, tagB64] = encoded.split(".");
  if (!ivB64 || !dataB64 || !tagB64) return "";

  try {
    const iv = Buffer.from(ivB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return "";
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return String(value ?? "").startsWith(PREFIX);
}

