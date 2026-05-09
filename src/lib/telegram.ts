import { db } from "@/lib/db";

export type TelegramInlineButton = { text: string; url: string };

function safeParseKinds(raw: string) {
  try {
    const v = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function sendTelegramMessage({
  text,
  parseMode,
  button,
  chatId,
  kind,
}: {
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  button?: TelegramInlineButton;
  chatId?: number | null;
  kind?: string;
}) {
  const settings = await db.query.telegramSettings.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  const token = settings?.botToken?.trim() ?? "";
  if (!token) return { ok: false as const, error: "missing_token" as const, message: "" };

  const chat = chatId
    ? await db.query.telegramChats.findFirst({
        where: (t, { and, eq }) => and(eq(t.id, chatId), eq(t.enabled, true)),
      })
    : await db.query.telegramChats
        .findMany({ where: (t, { eq }) => eq(t.enabled, true), orderBy: (t, { asc }) => [asc(t.name), asc(t.id)] })
        .then((rows) => {
          if (!rows.length) return null;
          if (!kind) return rows[0];
          const match = rows.find((c) => {
            const kinds = safeParseKinds(c.kindsJson);
            return !kinds.length || kinds.includes(kind);
          });
          return match ?? rows[0];
        });

  const chatIdent = chat?.chatId?.trim() ?? "";
  if (!chatIdent) return { ok: false as const, error: "missing_chat" as const, message: "" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdent,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        reply_markup: button ? { inline_keyboard: [[{ text: button.text, url: button.url }]] } : undefined,
      }),
    });

    const raw = await res.text().catch(() => "");
    if (!res.ok) return { ok: false as const, error: "send_failed" as const, message: raw.slice(0, 500) };

    const json = (raw ? (JSON.parse(raw) as { ok?: boolean; description?: string }) : null) as
      | { ok?: boolean; description?: string }
      | null;
    if (!json?.ok) return { ok: false as const, error: "send_failed" as const, message: json?.description || "Telegram API error" };

    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "telegram send failed";
    return { ok: false as const, error: "send_failed" as const, message: msg };
  }
}
