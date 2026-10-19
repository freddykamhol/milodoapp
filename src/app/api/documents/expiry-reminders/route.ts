import { NextResponse } from "next/server";

import { sendDocumentExpiryReminders } from "@/lib/document-expiry-reminders";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

async function authorized(request: Request) {
  const secret = process.env.DOCUMENT_REMINDER_CRON_SECRET?.trim();
  const cronSecret = request.headers.get("x-cron-secret")?.trim();
  if (secret && cronSecret && cronSecret === secret) return true;
  const viewer = await getViewer();
  return viewer?.role === "ADMIN" || viewer?.role === "VERWALTUNG";
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const result = await sendDocumentExpiryReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
