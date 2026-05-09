import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildServiceRemoteFilePath, withSftp } from "@/lib/sftp";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });

  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isFinite(fileId)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const file = await db.query.appointmentFiles.findFirst({ where: (t, { eq }) => eq(t.id, fileId) });
  if (!file) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (viewer.role === "KUNDE") {
    const appointment = await db.query.appointments.findFirst({
      where: (t, { eq }) => eq(t.id, file.appointmentId),
      columns: { id: true, customerId: true },
    });
    if (!appointment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const customer = await db.query.customers.findFirst({
      where: (t, { eq }) => eq(t.id, appointment.customerId),
      columns: { accountUserId: true },
    });
    if (!customer || customer.accountUserId !== viewer.id) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  const storageKey = String(file.storageKey || "");
  const fileName = String(file.fileName || "dienst.pdf");
  const parts = storageKey.split("/");
  const storedName = parts.at(-1) || "";
  if (!storedName) return NextResponse.json({ ok: false, error: "invalid_storage_key" }, { status: 500 });

  const result = await withSftp(async (client, basePath) => {
    const remotePath = buildServiceRemoteFilePath(basePath, storedName);
    const buf = (await client.get(remotePath)) as Buffer;
    return buf;
  }).catch(() => null);

  if (!result) return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });

  const body = new Uint8Array(result);
  return new NextResponse(body, {
    headers: {
      "content-type": file.mimeType || "application/pdf",
      "content-disposition": `attachment; filename=\"${encodeURIComponent(fileName)}\"`,
      "cache-control": "private, max-age=0, no-cache",
    },
  });
}
