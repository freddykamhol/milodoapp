import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/db/schema";
import { ensureBlogSchema } from "@/lib/blog-schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await ensureBlogSchema();
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;
  const category = String(url.searchParams.get("category") ?? "").trim();

  const where =
    category
      ? and(eq(blogPosts.status, "PUBLISHED"), eq(blogPosts.category, category))
      : and(eq(blogPosts.status, "PUBLISHED"));

  const rows = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      category: blogPosts.category,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      titleImageKey: blogPosts.titleImageKey,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(where)
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit);

  return NextResponse.json({ ok: true, rows });
}
