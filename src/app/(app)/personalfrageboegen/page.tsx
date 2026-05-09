import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import { AppShell } from "../_components/app-shell";
import { Badge, Card, type BadgeTone } from "../_components/ui";
import { db } from "@/lib/db";
import { personalQuestionnaires } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getViewer } from "@/lib/viewer";
import { ensurePersonalfrageboegenSchema } from "@/lib/personalfrageboegen";

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

export default async function PersonalfrageboegenPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") notFound();

  await ensurePersonalfrageboegenSchema();

  let rows: Array<typeof personalQuestionnaires.$inferSelect> = [];
  try {
    rows = await db
      .select()
      .from(personalQuestionnaires)
      .orderBy(desc(personalQuestionnaires.createdAt))
      .limit(250);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("created_user_id")) {
      await ensurePersonalfrageboegenSchema();
      rows = await db
        .select()
        .from(personalQuestionnaires)
        .orderBy(desc(personalQuestionnaires.createdAt))
        .limit(250);
    } else if (!msg.includes("no such table")) {
      throw e;
    }
  }

  return (
    <AppShell title="Personalfragebögen" subtitle="Eingänge aus dem öffentlichen Personalfragebogen (Honorar).">
      <Card title="Übersicht" description={`${rows.length} Einträge (max. 250 zuletzt).`}>
        <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {rows.length ? (
            rows.map((r) => (
              <Link
                key={r.id}
                href={`/personalfrageboegen/${r.id}`}
                className="flex flex-col gap-2 px-4 py-3 transition hover:bg-[var(--surface-2)] md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                    {r.email || "—"} ·{" "}
                    {r.createdAt ? new Date(r.createdAt).toLocaleString("de-DE") : "—"}
                  </p>
                </div>
                <div className="shrink-0">
                  <Badge tone={statusTone(String(r.status || ""))}>{statusLabel(String(r.status || ""))}</Badge>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-[color:var(--muted)]">Noch keine Einträge vorhanden.</div>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
