import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../_components/app-shell";
import { Badge, Card, type BadgeTone } from "../../_components/ui";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { QuestionnaireActionsClient } from "./_components/questionnaire-actions-client";
import { ensurePersonalfrageboegenSchema } from "@/lib/personalfrageboegen";

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

function statusTone(status: string): BadgeTone {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "REVIEWED") return "warning";
  return "muted";
}

function statusLabel(status: string) {
  if (status === "APPROVED") return "Freigegeben";
  if (status === "REJECTED") return "Abgelehnt";
  if (status === "REVIEWED") return "In Prüfung";
  return "Eingegangen";
}

function kindLabel(kind: string) {
  if (kind === "ZEUGNIS_MED") return "Zeugnis medizinische Qualifikation";
  if (kind === "FORTBILDUNG_RD") return "Rettungsdienst Fortbildungsnachweis";
  if (kind === "ARBEITSMED") return "Arbeitsmedizinische Untersuchung";
  if (kind === "FUEHRUNGSKRAEFTE") return "Führungskräfte Ausbildung";
  if (kind === "AUSBILDER_QUAL") return "Ausbilder-Qualifikation";
  if (kind === "FUEHRERSCHEIN") return "Führerschein";
  if (kind === "PSS") return "Personenbeförderungsschein";
  return "Sonstige Dokumente";
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    const parsed = JSON.parse(String(raw ?? ""));
    return parsed as T;
  } catch {
    return fallback;
  }
}

export default async function PersonalfragebogenDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!isAdminOrVerwaltung(viewer.role)) notFound();

  const { id } = await params;
  const questionnaireId = Number(id);
  if (!Number.isFinite(questionnaireId)) notFound();

  await ensurePersonalfrageboegenSchema();

  let row: any = null;
  try {
    row = await db.query.personalQuestionnaires.findFirst({
      where: (t, { eq }) => eq(t.id, questionnaireId),
      with: { files: true },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("created_user_id")) {
      await ensurePersonalfrageboegenSchema();
      row = await db.query.personalQuestionnaires.findFirst({
        where: (t, { eq }) => eq(t.id, questionnaireId),
        with: { files: true },
      });
    } else if (msg.includes("no such table")) {
      notFound();
    } else {
      throw e;
    }
  }
  if (!row) notFound();

  const einsatzfelder = safeJsonParse<string[]>(row.einsatzfelderJson ?? null, []);
  const sizes = safeJsonParse<Record<string, string>>(row.sizesJson ?? null, {});
  const driverLicences = safeJsonParse<string[]>(row.driverLicencesJson ?? null, []);
  const contactPrefs = safeJsonParse<string[]>(row.contactPrefsJson ?? null, []);

  const files = [...(row.files ?? [])].sort((a, b) => String(a.kind).localeCompare(String(b.kind)));

  return (
    <AppShell
      title={`Personalfragebogen #${row.id}`}
      subtitle={`${row.firstName} ${row.lastName} · ${row.email}`}
    >
      <QuestionnaireActionsClient
        questionnaireId={row.id}
        pdfHref={`/api/personalfrageboegen/${row.id}/pdf`}
        existingUsername={row.createdUsername ? String(row.createdUsername) : null}
        existingUserId={row.createdUserId ? Number(row.createdUserId) : null}
      />
      <div className="mb-4">
        <Link
          href="/personalfrageboegen"
          className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
        >
          Zur Übersicht
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Status"
          description={row.createdAt ? `Eingang: ${new Date(row.createdAt).toLocaleString("de-DE")}` : undefined}
        >
          <Badge tone={statusTone(String(row.status || ""))}>{statusLabel(String(row.status || ""))}</Badge>
        </Card>

        <Card title="Persönliche Daten">
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[color:var(--muted)]">Name:</span> {row.firstName} {row.lastName}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Geburtsdatum:</span>{" "}
              {row.geb ? new Date(row.geb).toLocaleDateString("de-DE") : "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Steuernummer:</span> {row.taxNumber || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Adresse:</span>{" "}
              {[row.street, row.houseNumber, row.plz, row.city, row.cityExtra].filter(Boolean).join(" ")}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Telefon:</span> {row.phone || "—"}{" "}
              {row.phone ? (row.phoneShare ? "(weitergeben: ja)" : "(weitergeben: nein)") : null}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">E‑Mail:</span> {row.email || "—"}
            </p>
          </div>
        </Card>

        <Card title="Bankverbindung">
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[color:var(--muted)]">Kontoinhaber:</span> {row.bankAccountHolder || "—"}{" "}
              {row.bankAccountHolderDiffers ? "(abweichend)" : "(entspricht Name)"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Kreditinstitut:</span> {row.bankName || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">IBAN:</span> {row.iban || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">BLZ:</span> {row.blz || "—"}
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Einsatz & Qualifikation">
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[color:var(--muted)]">Einsatzfelder:</span>{" "}
              {einsatzfelder.length ? einsatzfelder.join(", ") : "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Medizinische Qualifikation:</span> {row.qualMed || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">EH Ausbilder:</span> {row.qualEhAusbilder ? "ja" : "nein"}
            </p>
          </div>
        </Card>

        <Card title="Kleidungsgrößen">
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[color:var(--muted)]">T‑Shirt:</span> {sizes.tshirt || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Jacke:</span> {sizes.jacket || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Hose:</span> {sizes.pants || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Schuhe:</span> {sizes.shoes || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Handschuhe:</span> {sizes.gloves || "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Neutrale PSA:</span> {row.hasNeutralPsa ? "ja" : "nein"}
            </p>
          </div>
        </Card>

        <Card title="Fahrerlaubnis & Sonstiges">
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[color:var(--muted)]">Fahrerlaubnis:</span>{" "}
              {driverLicences.length ? driverLicences.join(", ") : "—"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">P‑Schein:</span> {row.hasPss ? "ja" : "nein"}
            </p>
            <p>
              <span className="text-[color:var(--muted)]">Eigener PKW:</span> {row.ownCar ? "ja" : "nein"}
            </p>
          </div>
        </Card>

        <Card title="Kontaktwunsch">
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[color:var(--muted)]">Kontakt erwünscht per:</span>{" "}
              {contactPrefs.length ? contactPrefs.join(", ") : "—"}
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Uploads" description="Downloads sind nur für Admin/Verwaltung sichtbar.">
          <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            {files.length ? (
              files.map((f) => (
                <div key={f.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight">{kindLabel(String(f.kind || ""))}</p>
                    <p className="mt-1 truncate text-xs text-[color:var(--muted)]">{f.originalName || f.fileName}</p>
                  </div>
                  <div className="shrink-0">
                    <a
                      href={`/api/personalfrageboegen/files/${f.id}/download`}
                      className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-[color:var(--muted)]">Keine Dateien hochgeladen.</div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
