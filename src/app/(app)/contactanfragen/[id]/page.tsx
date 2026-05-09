import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { AppShell } from "@/app/(app)/_components/app-shell";
import { db } from "@/lib/db";
import { contactInquiries } from "@/db/schema";
import { ensureContactInquiriesTable } from "@/lib/contact-inquiries";
import { getViewer } from "@/lib/viewer";
import ContactInquiryActions from "./quick-actions";

export const runtime = "nodejs";

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function modeLabel(mode: string) {
  const m = (mode || "").toLowerCase();
  if (m === "eh") return "EH-Ausbildung";
  if (m === "sanitaet") return "Sanitätsdienst";
  if (m === "boerse") return "Personal (Börse)";
  return "Kontakt";
}

function statusLabel(status: "NEW" | "DONE") {
  return status === "DONE" ? "ERLEDIGT" : "NEU";
}

export default async function ContactInquiryDetailPage(props: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) redirect("/dashboard");

  ensureContactInquiriesTable();
  const { id: idRaw } = await props.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) notFound();

  const row = await db.query.contactInquiries.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!row || row.deletedAt) notFound();

  if (!row.readAt) {
    await db
      .update(contactInquiries)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(eq(contactInquiries.id, id));
  }

  const details = safeJsonParse(row.detailsJson ?? "{}");
  const detailsObj = details && typeof details === "object" ? (details as Record<string, unknown>) : {};

  const contactCards = [
    { label: "Name", value: row.name || "—" },
    { label: "Firma", value: row.company || "—" },
    { label: "E‑Mail", value: row.email || "—" },
    { label: "Telefon", value: row.phone || "—" },
    { label: "IP", value: row.ip || "—" },
    { label: "Quelle", value: row.sourceUrl || "—" },
    { label: "Zeitpunkt", value: row.createdAt ? new Date(row.createdAt).toLocaleString("de-DE") : "—" },
  ] as const;

  const sections: Array<{ title: string; items: Array<{ label: string; value: string }> }> = [];
  if (row.mode === "eh") {
    sections.push({
      title: "Details EH-Ausbildung",
      items: [
        { label: "Zielgruppe", value: String(detailsObj.targetGroup ?? "—") },
        { label: "Wunschtermin", value: String(detailsObj.trainingDate ?? "—") },
        { label: "Ort", value: String(detailsObj.trainingLocation ?? "—") },
        { label: "Teilnehmende", value: String(detailsObj.participantCount ?? "—") },
      ],
    });
  } else if (row.mode === "sanitaet") {
    sections.push({
      title: "Details Sanitätsdienst",
      items: [
        { label: "Art", value: String(detailsObj.eventType ?? "—") },
        { label: "Datum", value: String(detailsObj.eventDate ?? "—") },
        { label: "Ort", value: String(detailsObj.eventLocation ?? "—") },
        { label: "Teilnehmerzahl", value: String(detailsObj.attendees ?? "—") },
        { label: "Dauer", value: String(detailsObj.eventDuration ?? "—") },
      ],
    });
  } else if (row.mode === "boerse") {
    sections.push({
      title: "Details Personal (Börse)",
      items: [
        { label: "Zeitraum von", value: String(detailsObj.shiftDateFrom ?? "—") },
        { label: "Zeitraum bis", value: String(detailsObj.shiftDateTo ?? "—") },
        { label: "Einsatzort", value: String(detailsObj.shiftLocation ?? "—") },
        { label: "Qualifikation", value: String(detailsObj.qualification ?? "—") },
        { label: "Anzahl", value: String(detailsObj.staffCount ?? "—") },
      ],
    });
  }

  return (
    <AppShell
      title={`Kontaktanfrage #${row.id}`}
      subtitle={`${modeLabel(row.mode)} · ${statusLabel(row.status)} · ${row.createdAt ? new Date(row.createdAt).toLocaleString("de-DE") : ""}`}
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link className="text-sm font-semibold text-[color:var(--muted)] hover:text-[var(--foreground)]" href="/contactanfragen">
            ← Zur Übersicht
          </Link>
          <ContactInquiryActions inquiryId={row.id} email={row.email} ip={row.ip} mode={row.mode} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Kontaktdaten</div>
            <div className="mt-4 grid gap-3">
              {contactCards.map((c) => (
                <div key={c.label} className="flex items-start justify-between gap-4">
                  <div className="text-sm font-semibold text-[color:var(--muted)]">{c.label}</div>
                  <div className="text-sm font-semibold text-right">{c.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Nachricht</div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{row.message || "—"}</div>
          </div>
        </div>

        {sections.map((s) => (
          <div key={s.title} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">{s.title}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {s.items.map((it) => (
                <div key={it.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">{it.label}</div>
                  <div className="mt-1 text-sm font-semibold">{it.value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Rohdaten</div>
          <pre className="mt-4 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-xs leading-relaxed">
            {JSON.stringify({ details: detailsObj }, null, 2)}
          </pre>
        </div>
      </div>
    </AppShell>
  );
}
