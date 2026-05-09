import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { notificationPrefs } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

const keys = [
  "NEW_SHIFT",
  "SHIFT_CHANGE",
  "URGENT_REQUESTS",
  "REQUESTS_GENERAL",
  "CUSTOMER_REQUEST",
  "SHIFT_REMINDER",
  "TIMESHEET",
  "BIRTHDAY",
  "CUSTOMER_SHIFT_RELEASED",
  "CUSTOMER_SHIFT_FILLED",
  "CUSTOMER_SHIFT_UNFILLED_2D",
] as const;

type PrefKey = (typeof keys)[number];

async function ensureDefaults(userId: number) {
  for (const key of keys) {
    await db
      .insert(notificationPrefs)
      .values({ userId, key })
      .onConflictDoNothing();
  }
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  await ensureDefaults(viewer.id);

  const rows = await db
    .select()
    .from(notificationPrefs)
    .where(and(eq(notificationPrefs.userId, viewer.id), inArray(notificationPrefs.key, keys)));

  return NextResponse.json({
    ok: true,
    prefs: rows.map((r) => ({
      key: r.key,
      telegramEnabled: r.telegramEnabled,
      emailEnabled: r.emailEnabled,
      reminderDaysBefore: r.reminderDaysBefore,
    })),
  });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const body = (await request.json()) as {
    key?: PrefKey;
    enabled?: boolean;
    telegramEnabled?: boolean;
    emailEnabled?: boolean;
    reminderDaysBefore?: number | null;
  };

  const key = body.key;
  if (!key || !keys.includes(key)) {
    return NextResponse.json({ ok: false, error: "invalid_key" }, { status: 400 });
  }

  await db
    .insert(notificationPrefs)
    .values({ userId: viewer.id, key })
    .onConflictDoNothing();

  const update: Partial<typeof notificationPrefs.$inferInsert> = { updatedAt: new Date() };

  if (typeof body.enabled === "boolean") {
    update.emailEnabled = body.enabled;
  }

  if (typeof body.telegramEnabled === "boolean") update.telegramEnabled = body.telegramEnabled;
  if (typeof body.emailEnabled === "boolean") update.emailEnabled = body.emailEnabled;
  if (key === "SHIFT_REMINDER") {
    if (body.reminderDaysBefore === null) update.reminderDaysBefore = null;
    else if (typeof body.reminderDaysBefore === "number" && Number.isFinite(body.reminderDaysBefore)) {
      update.reminderDaysBefore = Math.max(0, Math.min(60, Math.round(body.reminderDaysBefore)));
    }
  }

  await db
    .update(notificationPrefs)
    .set(update)
    .where(and(eq(notificationPrefs.userId, viewer.id), eq(notificationPrefs.key, key)));

  return NextResponse.json({ ok: true });
}
