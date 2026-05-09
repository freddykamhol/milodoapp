import { NextResponse } from "next/server";

import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  return NextResponse.json({
    ok: true,
    viewer: {
      id: viewer.id,
      role: viewer.role,
      username: viewer.username,
      firstName: viewer.firstName,
      lastName: viewer.lastName,
      email: viewer.email,
    },
  });
}
