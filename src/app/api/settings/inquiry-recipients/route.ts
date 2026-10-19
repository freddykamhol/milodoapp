import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { contactInquiryRecipients, users } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { inquiryTypes, type ContactInquiryMode, type ContactInquiryRecipientInsert } from "@/lib/contact-inquiry-recipients";

export const runtime = "nodejs";

async function canManage() {
  const viewer = await getViewer();
  if (!viewer) return { viewer: null, response: NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 }) };
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") return { viewer: null, response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { viewer, response: null };
}

export async function GET() {
  const access = await canManage();
  if (access.response) return access.response;
  const [recipients, memberRows] = await Promise.all([
    db.select().from(contactInquiryRecipients),
    db.select({ id: users.id, username: users.username, email: users.email, role: users.role }).from(users),
  ]);
  return NextResponse.json({
    ok: true,
    types: inquiryTypes.map((item) => ({ ...item, recipients: recipients.filter((recipient) => recipient.mode === item.mode).map((recipient) => ({
      type: recipient.recipientType,
      originMode: recipient.originMode,
      role: recipient.role,
      userId: recipient.userId,
      email: recipient.email,
    })) })),
    users: memberRows.map((user) => ({ ...user, email: user.email ?? "" })),
  });
}

export async function PATCH(request: Request) {
  const access = await canManage();
  if (access.response) return access.response;
  const body = await request.json().catch(() => null) as {
    mode?: ContactInquiryMode;
    recipients?: Array<{ type: "ROLE" | "USER" | "EMAIL"; role?: string | null; userId?: number | null; email?: string | null; originMode?: ContactInquiryMode | null }>;
  } | null;
  if (!body?.mode || !inquiryTypes.some((item) => item.mode === body.mode) || !Array.isArray(body.recipients)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const clean: ContactInquiryRecipientInsert[] = body.recipients.flatMap((recipient): ContactInquiryRecipientInsert[] => {
    if (recipient.type === "ROLE" && ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"].includes(String(recipient.role))) {
      return [{ mode: body.mode!, recipientType: "ROLE", role: recipient.role as "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE" }];
    }
    if (recipient.type === "USER" && Number.isInteger(recipient.userId)) {
      return [{ mode: body.mode!, recipientType: "USER", userId: Number(recipient.userId) }];
    }
    const email = String(recipient.email ?? "").trim().toLowerCase();
    if (recipient.type === "EMAIL" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const originMode = recipient.originMode && inquiryTypes.some((item) => item.mode === recipient.originMode)
        ? recipient.originMode
        : body.mode!;
      return [{ mode: body.mode!, recipientType: "EMAIL", email, originMode }];
    }
    return [];
  });

  const unique = Array.from(new Map(clean.map((recipient) => [
    recipient.recipientType === "ROLE" ? `ROLE:${recipient.role}` : recipient.recipientType === "USER" ? `USER:${recipient.userId}` : `EMAIL:${recipient.email}`,
    recipient,
  ])).values());
  if (!unique.length) return NextResponse.json({ ok: false, error: "recipient_required" }, { status: 400 });

  db.transaction((transaction) => {
    transaction.delete(contactInquiryRecipients).where(eq(contactInquiryRecipients.mode, body.mode!)).run();
    transaction.insert(contactInquiryRecipients).values(unique).run();
  });
  return NextResponse.json({ ok: true });
}
