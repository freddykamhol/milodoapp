import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { telegramChats } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function normalizeTelegramJoinLink(input: string) {
  const raw = input.trim();
  if (!raw) return "";

  const withoutProto = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^tg:\/\//i, "")
    .trim();

  const withoutDomain = withoutProto.startsWith("t.me/") ? withoutProto.slice("t.me/".length) : withoutProto;
  const path = withoutDomain.replace(/^\//, "");
  if (!path) return "";

  if (path.startsWith("@")) return `https://t.me/${path.slice(1)}`;
  if (path.startsWith("+")) return `https://t.me/${path}`;
  if (path.startsWith("joinchat/")) return `https://t.me/${path}`;
  if (/^[a-zA-Z0-9_]{4,}$/.test(path)) return `https://t.me/${path}`;

  if (/^t\.me\//i.test(withoutProto)) return `https://${withoutProto}`;
  if (/^https?:\/\//i.test(raw)) return raw;

  return `https://t.me/${encodeURIComponent(path)}`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const chatIdNum = Number(id);
  if (!Number.isFinite(chatIdNum)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const body = (await request.json()) as Partial<{
    enabled: boolean;
    name: string;
    chatId: string;
    inviteUrl: string;
    kindsJson: string;
  }>;
  const update: Partial<typeof telegramChats.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.chatId === "string") update.chatId = body.chatId.trim();
  if (typeof body.inviteUrl === "string") update.inviteUrl = normalizeTelegramJoinLink(body.inviteUrl);
  if (typeof body.kindsJson === "string") update.kindsJson = body.kindsJson.trim();

  await db.update(telegramChats).set(update).where(eq(telegramChats.id, chatIdNum));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const chatIdNum = Number(id);
  if (!Number.isFinite(chatIdNum)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  await db.delete(telegramChats).where(eq(telegramChats.id, chatIdNum));
  return NextResponse.json({ ok: true });
}
