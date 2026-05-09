import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { passwordResetTokens } from "@/db/schema";

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateResetToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function createPasswordResetToken(userId: number, { ttlMinutes = 60 }: { ttlMinutes?: number } = {}) {
  const token = generateResetToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function consumePasswordResetToken(token: string) {
  const tokenHash = sha256Hex(token);
  const now = new Date();

  const row = await db.query.passwordResetTokens.findFirst({
    where: (t, { and, eq, gt, isNull }) =>
      and(eq(t.tokenHash, tokenHash), gt(t.expiresAt, now), isNull(t.usedAt)),
  });
  if (!row) return null;

  await db
    .update(passwordResetTokens)
    .set({ usedAt: now, updatedAt: now })
    .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)));

  return row;
}
