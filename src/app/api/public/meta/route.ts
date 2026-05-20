import { NextResponse } from "next/server";

import { getPublicApiUrl } from "@/lib/public-api-url";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    publicApiUrl: getPublicApiUrl(),
  });
}

