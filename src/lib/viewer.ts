import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { authCookieName, parseAuthCookieUserId } from "@/lib/auth-cookie";

export async function getViewer() {
  const store = await cookies();
  const authedUserId = parseAuthCookieUserId(store.get(authCookieName())?.value);
  const allowDemo = (process.env.ALLOW_DEMO_AUTH ?? "0") !== "0";
  const fallbackDemoId = allowDemo ? Number(process.env.DEMO_USER_ID ?? "1") : NaN;

  const userId = authedUserId ?? (Number.isFinite(fallbackDemoId) ? fallbackDemoId : null);
  if (!userId) return null;

  return (await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) })) ?? null;
}
