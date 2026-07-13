import { NextResponse } from "next/server";

import { getViewer } from "@/lib/viewer";
import { createSmtpTransporter, getSmtpConfig } from "@/lib/smtp-mail";

export const runtime = "nodejs";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const smtp = await getSmtpConfig();
  if (!smtp.ok) return NextResponse.json({ ok: false, error: smtp.error }, { status: 400 });

  try {
    const transporter = createSmtpTransporter(smtp.config);
    await transporter.verify();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMTP verify failed";
    return NextResponse.json({ ok: false, error: "verify_failed", message: msg }, { status: 400 });
  }
}
