import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { calendarCategoryColors } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

const allowed = new Set(["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE", "FAHRZEUGWARTUNG", "MATERIALPRUEFUNG", "MANGELTERMIN", "SONSTIGES"]);
function manager(role: string) { return role === "ADMIN" || role === "VERWALTUNG"; }
export async function GET() { const viewer = await getViewer(); if (!viewer) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); return NextResponse.json({ rows: await db.select().from(calendarCategoryColors) }); }
export async function PATCH(request: Request) {
  const viewer = await getViewer(); if (!viewer || !manager(viewer.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { category?: unknown; color?: unknown } | null;
  const category = String(body?.category ?? ""); const color = String(body?.color ?? "");
  if (!allowed.has(category) || !/^#[0-9a-fA-F]{6}$/.test(color)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await db.insert(calendarCategoryColors).values({ category, color, updatedAt: new Date() }).onConflictDoUpdate({ target: calendarCategoryColors.category, set: { color, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
