import {blogPosts} from "@/db/schema";
import {eq} from "drizzle-orm";
import {ensureBlogSchema} from "@/lib/blog-schema";
import {db} from "@/lib/db";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../_components/app-shell";
import { BlogEditorClient } from "../_components/blog-editor-client";
import { getViewer } from "@/lib/viewer";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export default async function BlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!isAdminOrVerwaltung(viewer.role)) notFound();

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) notFound();

  await ensureBlogSchema();
  const initialPost=await db.select({id:blogPosts.id,status:blogPosts.status,title:blogPosts.title,category:blogPosts.category,slug:blogPosts.slug,excerpt:blogPosts.excerpt,contentMd:blogPosts.contentMd,contentBlocksJson:blogPosts.contentBlocksJson,titleImageKey:blogPosts.titleImageKey}).from(blogPosts).where(eq(blogPosts.id,postId)).get();
  if(!initialPost)notFound();
  return (
    <AppShell title={`Beitrag #${postId}`} subtitle="Bearbeiten, Bilder einbinden und veröffentlichen.">
      <BlogEditorClient key={postId} initialPost={initialPost} mode="edit" postId={postId} />
    </AppShell>
  );
}

