import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../_components/app-shell";
import { BlogEditorClient } from "../_components/blog-editor-client";
import { getViewer } from "@/lib/viewer";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export default async function BlogNewPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!isAdminOrVerwaltung(viewer.role)) notFound();

  return (
    <AppShell title="Neuer Beitrag" subtitle="Erstelle einen neuen Blog-Beitrag.">
      <BlogEditorClient mode="new" />
    </AppShell>
  );
}

