import { NextResponse } from "next/server";

import { getViewer } from "@/lib/viewer";
import { sendCustomEmail } from "@/lib/custom-email";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

function norm(v: unknown, max = 5000) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function isProbablyEmail(value: string) {
  if (value.length < 6 || value.length > 254) return false;
  if (!value.includes("@")) return false;
  if (/\s/.test(value)) return false;
  return true;
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Partial<{
    to: string;
    kind: "HONORAR" | "MINIJOB";
    subject: string;
    message: string;
  }>;

  const to = norm(body.to, 254).toLowerCase();
  if (!to) return NextResponse.json({ ok: false, error: "missing_to" }, { status: 400 });
  if (!isProbablyEmail(to)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });

  const kind = body.kind === "MINIJOB" ? "MINIJOB" : "HONORAR";
  const formPath = kind === "MINIJOB" ? "/personalfragebogen-minijob" : "/personalfragebogen-honorar";
  const link = `${getAppUrl()}${formPath}`;

  const subject =
    norm(body.subject, 180) ||
    (kind === "MINIJOB" ? "MILODO – Personalfragebogen (Minijob)" : "MILODO – Personalfragebogen (Honorar)");

  const customMessage = norm(body.message, 5000);
  const message =
    (customMessage ||
      "Hallo,\n\nbitte fülle den Personalfragebogen über den folgenden Link aus:\n") +
    `\n\n${link}\n\nViele Grüße\nMILODO medical`;

  try {
    const res = await sendCustomEmail({ to, subject, message });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    return NextResponse.json({ ok: false, error: "send_failed", message: msg }, { status: 500 });
  }
}

