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

  return (
    <AppShell title={`Beitrag #${postId}`} subtitle="Bearbeiten, Bilder einbinden und veröffentlichen.">
      <BlogEditorClient mode="edit" postId={postId} />
    </AppShell>
  );
}

