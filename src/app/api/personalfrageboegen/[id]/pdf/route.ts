import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { renderPersonalfragebogenHonorarPdf } from "@/lib/personalfrageboegen-pdf";

export const runtime = "nodejs";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response("unauthorized", { status: 401 });
  if (!isAdminOrVerwaltung(viewer.role)) return new Response("forbidden", { status: 403 });

  const { id } = await params;
  const questionnaireId = Number(id);
  if (!Number.isFinite(questionnaireId)) return new Response("invalid id", { status: 400 });

  let row: any = null;
  try {
    row = await db.query.personalQuestionnaires.findFirst({
      where: (t, { eq }) => eq(t.id, questionnaireId),
      with: { files: true },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("no such table")) return new Response("not found", { status: 404 });
    throw e;
  }

  if (!row) return new Response("not found", { status: 404 });

  const uploadedCount = Array.isArray(row.files) ? row.files.length : 0;
  const bytes = await renderPersonalfragebogenHonorarPdf({
    questionnaire: {
      id: row.id,
      createdAt: row.createdAt ?? null,
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      geb: row.geb ?? null,
      taxNumber: row.taxNumber ?? "",
      street: row.street ?? "",
      houseNumber: row.houseNumber ?? "",
      plz: row.plz ?? "",
      city: row.city ?? "",
      cityExtra: row.cityExtra ?? "",
      phone: row.phone ?? "",
      phoneShare: Boolean(row.phoneShare),
      email: row.email ?? "",
      bankAccountHolder: row.bankAccountHolder ?? "",
      bankAccountHolderDiffers: Boolean(row.bankAccountHolderDiffers),
      bankName: row.bankName ?? "",
      iban: row.iban ?? "",
      blz: row.blz ?? "",
      einsatzfelderJson: row.einsatzfelderJson ?? "[]",
      qualMed: row.qualMed ?? null,
      qualEhAusbilder: Boolean(row.qualEhAusbilder),
      sizesJson: row.sizesJson ?? "{}",
      hasNeutralPsa: Boolean(row.hasNeutralPsa),
      driverLicencesJson: row.driverLicencesJson ?? "[]",
      hasPss: Boolean(row.hasPss),
      ownCar: Boolean(row.ownCar),
      contactPrefsJson: row.contactPrefsJson ?? "[]",
    },
    uploadedCount,
  });

  const fileName = `Personalfragebogen-Honorar-${row.lastName || "Person"}-${row.id}.pdf`;
  return new Response(Uint8Array.from(bytes).buffer, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "cache-control": "no-store, max-age=0",
    },
  });
}
