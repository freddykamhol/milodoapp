import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { telegramChats, telegramSettings } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

async function ensureRow() {
  await db
    .insert(telegramSettings)
    .values({ id: 1 })
    .onConflictDoNothing();
}

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

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  const isAdmin = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";

  await ensureRow();
  const row = isAdmin ? await db.query.telegramSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) }) : null;
  const chats = await db.query.telegramChats.findMany({ orderBy: (t, { asc }) => [asc(t.name), asc(t.id)] });

  return NextResponse.json({
    ok: true,
	    telegram: {
	      botToken: isAdmin ? row?.botToken ?? "" : "",
	      chats: isAdmin
	        ? chats.map((c) => ({
	            id: c.id,
	            enabled: c.enabled,
	            name: c.name,
	            chatId: c.chatId,
	            inviteUrl: c.inviteUrl,
	            kindsJson: c.kindsJson,
	          }))
	        : chats
	            .filter((c) => c.enabled && !!c.inviteUrl.trim())
	            .map((c) => ({ name: c.name, inviteUrl: c.inviteUrl })),
	    },
	  });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  await ensureRow();
  const body = (await request.json()) as { botToken?: string };
  if (typeof body.botToken !== "string") return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  await db
    .update(telegramSettings)
    .set({ botToken: body.botToken.trim(), updatedAt: new Date() })
    .where(eq(telegramSettings.id, 1));
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; chatId?: string; inviteUrl?: string };
  const name = String(body.name ?? "").trim();
  const chatId = String(body.chatId ?? "").trim();
  const inviteUrl = normalizeTelegramJoinLink(String(body.inviteUrl ?? "")) || normalizeTelegramJoinLink(name);
  if (!name || !chatId) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const inserted = await db
    .insert(telegramChats)
    .values({ name, chatId, inviteUrl, enabled: true })
    .returning({ id: telegramChats.id });

  return NextResponse.json({ ok: true, id: inserted.at(0)?.id ?? null });
}
