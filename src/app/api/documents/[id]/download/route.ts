import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { readStoredDocument } from "@/lib/document-storage";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const { id } = await params;
  const docId = Number(id);
  if (!Number.isSafeInteger(docId) || docId < 1) return NextResponse.json({ ok: false }, { status: 400 });

  const doc = await db.query.documents.findFirst({ where: (t, { eq }) => eq(t.id, docId) });
  if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

  const canView = isAdminOrVerwaltung(viewer.role) || viewer.id === doc.ownerId;
  if (!canView) return NextResponse.json({ ok: false }, { status: 403 });

  let bytes: Buffer;
  try {
    bytes = await readStoredDocument(doc);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "document_read_failed";
    if (msg.includes("not found") || msg.includes("No such file") || msg === "ENOENT") {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "document_read_failed" }, { status: 503 });
  }

  const body = Uint8Array.from(bytes).buffer;
  return new Response(body, {
    headers: {
      "content-type": doc.mimeType ?? "application/octet-stream",
      "content-disposition": `${new URL(request.url).searchParams.get("inline") === "1" && /^(image\/(png|jpeg|webp|gif|avif)|application\/pdf)$/.test(doc.mimeType??'') ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.fileName)}"`,
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    },
  });
}
