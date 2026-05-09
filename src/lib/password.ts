import crypto from "node:crypto";

export function hashPassword(plain: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(plain, salt, 32);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1] || "", "hex");
  const expected = Buffer.from(parts[2] || "", "hex");
  if (salt.length !== 16 || expected.length !== 32) return false;
  const derived = crypto.scryptSync(plain, salt, 32);
  return crypto.timingSafeEqual(derived, expected);
}

