import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { memberRegistrationForms } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (viewer.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const formId = Number(id);
  if (!Number.isFinite(formId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  await db.delete(memberRegistrationForms).where(eq(memberRegistrationForms.id, formId));
  return NextResponse.json({ ok: true });
}
