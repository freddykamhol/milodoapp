import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { chatId?: number };
  const chatId = typeof body.chatId === "number" ? body.chatId : null;

  const text = `✅ Milodo Testnachricht (${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date())})`;

  const result = await sendTelegramMessage({ chatId, text });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
