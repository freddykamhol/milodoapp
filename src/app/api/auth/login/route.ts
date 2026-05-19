import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildAuthCookieValue, authCookieName } from "@/lib/auth-cookie";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!username || !password) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const user =
    (await db.query.users.findFirst({
      where: (t, { eq }) => eq(t.username, username),
      columns: { id: true, passwordHash: true, locked: true },
    })) ?? null;

  if (!user?.id || user.locked) return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
  if (!verifyPassword(password, user.passwordHash)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });

  const value = buildAuthCookieValue(user.id);
  if (!value) {
    return NextResponse.json(
      { ok: false, error: "auth_secret_missing" },
      { status: 500 },
    );
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const requestProto = forwardedProto ? forwardedProto.split(",")[0]?.trim() : new URL(request.url).protocol.replace(":", "");
  const isHttps = requestProto === "https";

  const res = NextResponse.json({ ok: true });
  res.cookies.set(authCookieName(), value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && isHttps,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
