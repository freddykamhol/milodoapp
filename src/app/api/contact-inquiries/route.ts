import { NextResponse } from "next/server";
import type { SQLWrapper } from "drizzle-orm";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { contactInquiries } from "@/db/schema";
import { ensureContactInquiriesTable } from "@/lib/contact-inquiries";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function norm(v: unknown, max = 200) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  ensureContactInquiriesTable();

  const url = new URL(request.url);
  const mode = norm(url.searchParams.get("mode"), 32);
  const unread = norm(url.searchParams.get("unread"), 10);
  const sort = norm(url.searchParams.get("sort"), 16) || "newest";
  const days = Number(url.searchParams.get("days") ?? "");
  const from = norm(url.searchParams.get("from"), 32);
  const to = norm(url.searchParams.get("to"), 32);
  const q = norm(url.searchParams.get("q"), 200).toLowerCase();
  const includeDeleted = norm(url.searchParams.get("includeDeleted"), 10) === "1";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50));

  const where: SQLWrapper[] = [];
  if (!includeDeleted) where.push(isNull(contactInquiries.deletedAt));
  if (mode) where.push(eq(contactInquiries.mode, mode));
  if (unread === "1") where.push(isNull(contactInquiries.readAt));
  if (unread === "0") where.push(sql`${contactInquiries.readAt} IS NOT NULL`);

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const daysDate = Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
  if (daysDate) where.push(gte(contactInquiries.createdAt, daysDate));
  if (fromDate && !Number.isNaN(fromDate.getTime())) where.push(gte(contactInquiries.createdAt, fromDate));
  if (toDate && !Number.isNaN(toDate.getTime())) where.push(lte(contactInquiries.createdAt, toDate));

  if (q) {
    const like = `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const clause = or(
      sql`lower(${contactInquiries.name}) LIKE ${like}`,
      sql`lower(${contactInquiries.company}) LIKE ${like}`,
      sql`lower(${contactInquiries.email}) LIKE ${like}`,
      sql`lower(${contactInquiries.message}) LIKE ${like}`,
    );
    if (clause) where.push(clause);
  }

  const orderBy = sort === "oldest" ? contactInquiries.createdAt : desc(contactInquiries.createdAt);

  const items = await db
    .select({
      id: contactInquiries.id,
      createdAt: contactInquiries.createdAt,
      status: contactInquiries.status,
      mode: contactInquiries.mode,
      name: contactInquiries.name,
      company: contactInquiries.company,
      email: contactInquiries.email,
      phone: contactInquiries.phone,
      message: contactInquiries.message,
      sourceUrl: contactInquiries.sourceUrl,
      readAt: contactInquiries.readAt,
      ip: contactInquiries.ip,
    })
    .from(contactInquiries)
    .where(where.length ? and(...where) : undefined)
    .orderBy(orderBy)
    .limit(limit);

  return NextResponse.json({ ok: true, items });
}
