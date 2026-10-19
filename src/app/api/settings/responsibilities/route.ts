import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { responsibilityRecipients, users } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

const roles = ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"] as const;
const types = ["VEHICLE", "MATERIAL"] as const;
const manager = (role: string) => role === "ADMIN" || role === "VERWALTUNG";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET() {
  const viewer = await getViewer(); if (!viewer) return json({ error: "unauthorized" }, 401);
  const [rows, memberRows] = await Promise.all([
    db.select({ id: responsibilityRecipients.id, type: responsibilityRecipients.type, recipientType: responsibilityRecipients.recipientType, role: responsibilityRecipients.role, userId: responsibilityRecipients.userId, email: responsibilityRecipients.email, location: responsibilityRecipients.location, username: users.username }).from(responsibilityRecipients).leftJoin(users, eq(responsibilityRecipients.userId, users.id)),
    db.select({ id: users.id, username: users.username, email: users.email, role: users.role, qualRD: users.qualRD, qualAusb: users.qualAusb }).from(users).where(eq(users.locked, false)),
  ]);
  return json({ rows, users: memberRows });
}

export async function PUT(request: Request) {
  const viewer = await getViewer(); if (!viewer || !manager(viewer.role)) return json({ error: "forbidden" }, 403);
  const body = await request.json().catch(() => null) as { type?: unknown; location?: unknown; recipients?: unknown } | null;
  const type = String(body?.type ?? ""); const location = String(body?.location ?? "");
  if (!types.includes(type as typeof types[number]) || !Array.isArray(body?.recipients)) return json({ error: "invalid" }, 400);
  type Insert = typeof responsibilityRecipients.$inferInsert;
  const values: Insert[] = [];
  for (const raw of body.recipients) {
    const item = raw as { type?: unknown; role?: unknown; userId?: unknown; email?: unknown };
    const recipientType = String(item.type ?? "");
    if (recipientType === "ROLE" && roles.includes(String(item.role) as typeof roles[number])) values.push({ type: type as typeof types[number], recipientType: "ROLE", role: String(item.role) as typeof roles[number], location, createdAt: new Date() });
    if (recipientType === "USER" && Number.isSafeInteger(Number(item.userId))) values.push({ type: type as typeof types[number], recipientType: "USER", userId: Number(item.userId), location, createdAt: new Date() });
    if (recipientType === "EMAIL" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(item.email ?? "").trim())) values.push({ type: type as typeof types[number], recipientType: "EMAIL", email: String(item.email).trim().toLowerCase(), location, createdAt: new Date() });
  }
  await db.delete(responsibilityRecipients).where(eq(responsibilityRecipients.type, type as typeof types[number]));
  if (values.length) await db.insert(responsibilityRecipients).values(values);
  return json({ ok: true });
}
