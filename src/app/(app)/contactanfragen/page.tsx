import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/(app)/_components/app-shell";
import { db } from "@/lib/db";
import { contactInquiries } from "@/db/schema";
import { ensureContactInquiriesTable } from "@/lib/contact-inquiries";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

function labelForMode(mode: string) {
  const m = (mode || "").toLowerCase();
  if (m === "eh") return "EH-Ausbildung";
  if (m === "sanitaet") return "Sanitätsdienst";
  if (m === "boerse") return "Personal (Börse)";
  return "Kontakt";
}

export default async function ContactAnfragenPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) redirect("/dashboard");

  ensureContactInquiriesTable();

  const rows = await db
    .select()
    .from(contactInquiries)
    .orderBy(desc(contactInquiries.createdAt))
    .limit(200);

  return (
    <AppShell
      title="Kontaktanfragen"
      subtitle="Neue Website-Anfragen, inkl. Mail-Versandstatus in den Logs."
    >
      <div className="grid gap-4">
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[color:var(--muted)] shadow-[var(--shadow-soft)]">
            Noch keine Anfragen.
          </div>
        ) : null}

        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">
                  #{row.id} · {labelForMode(row.mode)} · {row.status}
                </div>
                <div className="mt-1 truncate text-lg font-semibold tracking-tight">
                  {row.name || "—"}
                  {row.company ? <span className="text-[color:var(--muted)]"> · {row.company}</span> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[color:var(--muted)]">
                  <div>{row.email || "—"}</div>
                  {row.phone ? <div>{row.phone}</div> : null}
                </div>
              </div>

              <div className="text-xs text-[color:var(--muted)]">
                {row.createdAt ? new Date(row.createdAt).toLocaleString("de-DE") : "—"}
              </div>
            </div>

            {row.message ? (
              <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm leading-relaxed">
                {row.message}
              </div>
            ) : null}

            {row.sourceUrl ? (
              <div className="mt-4 text-xs text-[color:var(--muted)]">
                Quelle: <span className="font-mono">{row.sourceUrl}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
