import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { documentExpiryPreferences, documentExpiryRecipients, documentExpirySettings, documents, users } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { addCalendarMonths } from "@/lib/document-expiry";

export const runtime = "nodejs";

const categories = ["TRAINING", "DRIVER_LICENSE", "QUALIFICATION"] as const;
type Category = (typeof categories)[number];
type RecipientInsert = typeof documentExpiryRecipients.$inferInsert;

const definitions = [
  { category: "TRAINING", label: "Aus- und Fortbildungsnachweise" },
  { category: "DRIVER_LICENSE", label: "Fahrerlaubnisse" },
  { category: "QUALIFICATION", label: "Qualifikationen" },
] as const;

function allowed(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

async function ensureDefaults() {
  for (const category of categories) {
    await db.insert(documentExpirySettings).values({ category }).onConflictDoNothing();
    const recipients = await db.select({ id: documentExpiryRecipients.id }).from(documentExpiryRecipients).where(eq(documentExpiryRecipients.category, category)).limit(1);
    if (!recipients.length) {
      await db.insert(documentExpiryRecipients).values([
        { category, recipientType: "ROLE", role: "ADMIN" },
        { category, recipientType: "ROLE", role: "VERWALTUNG" },
      ]);
    }
  }
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!allowed(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  await ensureDefaults();
  await db.insert(documentExpiryPreferences).values({ id: 1 }).onConflictDoNothing();
  const preferences = await db.query.documentExpiryPreferences.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  const rows = await db.select().from(documentExpirySettings).where(inArray(documentExpirySettings.category, categories));
  const recipients = await db.select().from(documentExpiryRecipients).where(inArray(documentExpiryRecipients.category, categories));
  const memberRows = await db.select({ id: users.id, username: users.username, email: users.email, role: users.role }).from(users).where(inArray(users.role, ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"]));
  return NextResponse.json({
    ok: true,
    manualExpiryRequiresApproval: preferences?.manualExpiryRequiresApproval ?? false,
    settings: definitions.map((definition) => {
      const row = rows.find((item) => item.category === definition.category);
      return {
        ...definition,
        expiryMonths: row?.expiryMonths ?? 0,
        reminderDaysBefore: row?.reminderDaysBefore ?? 0,
        recipients: recipients.filter((recipient) => recipient.category === definition.category).map((recipient) => ({
          type: recipient.recipientType,
          role: recipient.role,
          userId: recipient.userId,
          email: recipient.email,
          originCategory: recipient.originCategory,
        })),
      };
    }),
    users: memberRows.map((user) => ({ ...user, email: user.email ?? "" })),
  });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!allowed(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = (await request.json()) as {
    category?: Category;
    manualExpiryRequiresApproval?: boolean;
    expiryMonths?: number;
    reminderDaysBefore?: number;
    recipients?: Array<{ type: "ROLE" | "USER" | "EMAIL"; role?: string | null; userId?: number | null; email?: string | null; originCategory?: Category | null }>;
  };
  if (typeof body.manualExpiryRequiresApproval === "boolean") {
    await db.insert(documentExpiryPreferences).values({ id: 1, manualExpiryRequiresApproval: body.manualExpiryRequiresApproval })
      .onConflictDoUpdate({ target: documentExpiryPreferences.id, set: { manualExpiryRequiresApproval: body.manualExpiryRequiresApproval, updatedAt: new Date() } });
  }
  if (!body.category) return NextResponse.json({ ok: true });
  if (!categories.includes(body.category)) return NextResponse.json({ ok: false, error: "invalid_category" }, { status: 400 });
  if (body.recipients) {
    const clean: RecipientInsert[] = body.recipients.flatMap((recipient): RecipientInsert[] => {
      if (recipient.type === "ROLE" && ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"].includes(String(recipient.role))) {
        return [{ category: body.category!, recipientType: "ROLE" as const, role: recipient.role as "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE" }];
      }
      if (recipient.type === "USER" && Number.isInteger(recipient.userId)) {
        return [{ category: body.category!, recipientType: "USER" as const, userId: Number(recipient.userId) }];
      }
      const email = String(recipient.email ?? "").trim().toLowerCase();
      if (recipient.type === "EMAIL" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return [{ category: body.category!, recipientType: "EMAIL" as const, email, originCategory: recipient.originCategory ?? body.category }];
      }
      return [];
    });
    await db.delete(documentExpiryRecipients).where(eq(documentExpiryRecipients.category, body.category));
    if (clean.length) await db.insert(documentExpiryRecipients).values(clean).onConflictDoNothing();
  }
  const expiryMonths = typeof body.expiryMonths === "number" && Number.isFinite(body.expiryMonths) ? Math.max(0, Math.min(1200, Math.round(body.expiryMonths))) : 0;
  const reminderDaysBefore = typeof body.reminderDaysBefore === "number" && Number.isFinite(body.reminderDaysBefore) ? Math.max(0, Math.min(3650, Math.round(body.reminderDaysBefore))) : 0;
  const currentSetting = await db.query.documentExpirySettings.findFirst({ where: (t, { eq }) => eq(t.category, body.category!) });
  await db.insert(documentExpirySettings).values({ category: body.category, expiryMonths, reminderDaysBefore }).onConflictDoUpdate({
    target: documentExpirySettings.category,
    set: { expiryMonths, reminderDaysBefore, updatedAt: new Date() },
  });
  if ((!currentSetting && expiryMonths > 0) || (currentSetting && currentSetting.expiryMonths !== expiryMonths)) {
    const categoryDocs = await db.select({ id: documents.id, createdAt: documents.createdAt })
      .from(documents)
      .where(eq(documents.category, body.category));
    for (const document of categoryDocs) {
      await db.update(documents)
        .set({
          expiresAt: expiryMonths > 0 ? addCalendarMonths(document.createdAt, expiryMonths) : null,
          expiryReminderSentAt: null,
          expiredReminderSentAt: null,
          ownerExpiryReminderSentAt: null,
          ownerExpiredReminderSentAt: null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, document.id));
    }
  }
  return NextResponse.json({ ok: true });
}
