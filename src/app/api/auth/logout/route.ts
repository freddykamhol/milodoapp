import { NextResponse } from "next/server";

import { authCookieName } from "@/lib/auth-cookie";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const requestProto = forwardedProto ? forwardedProto.split(",")[0]?.trim() : new URL(request.url).protocol.replace(":", "");
  const isHttps = requestProto === "https";

  const res = NextResponse.json({ ok: true });
  res.cookies.set(authCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && isHttps,
    path: "/",
    maxAge: 0,
  });
  return res;
}
