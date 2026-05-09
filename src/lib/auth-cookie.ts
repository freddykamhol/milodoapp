import crypto from "node:crypto";

const COOKIE_NAME = "milodo_auth";

function requiredSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return secret;
}

function hmac(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function buildAuthCookieValue(userId: number) {
  const secret = requiredSecret();
  if (!secret) return null;
  const id = String(userId);
  return `${id}.${hmac(secret, id)}`;
}

export function parseAuthCookieUserId(value: string | undefined | null) {
  const secret = requiredSecret();
  if (!secret) return null;
  const raw = String(value ?? "");
  const [id, sig] = raw.split(".");
  if (!id || !sig) return null;
  const expected = hmac(secret, id);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

export function authCookieName() {
  return COOKIE_NAME;
}

