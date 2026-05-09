import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, gte, inArray } from "drizzle-orm";

import { AppShell } from "../../_components/app-shell";
import { Badge, Card } from "../../_components/ui";
import { db } from "@/lib/db";
import { appointmentFiles, appointments, customers } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function ServiceDocumentsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "KUNDE") notFound();

  const customer = await db.query.customers.findFirst({
    where: (t, { eq }) => eq(t.accountUserId, viewer.id),
  });
  if (!customer) {
    return (
      <AppShell title="Dokumente" subtitle="Dienstdokumente">
        <Card title="Kein Kunde verknüpft" description="Zu diesem Account ist kein Kunde hinterlegt.">
          <p className="text-sm text-[color:var(--muted)]">Bitte Admin/Verwaltung kontaktieren.</p>
        </Card>
      </AppShell>
    );
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const appts = await db
    .select({
      id: appointments.id,
      title: appointments.title,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      approved: appointments.approved,
      staffingStatus: appointments.staffingStatus,
    })
    .from(appointments)
    .where(and(eq(appointments.customerId, customer.id), eq(appointments.state, "OPEN"), gte(appointments.startAt, cutoff)))
    .orderBy(asc(appointments.startAt))
    .limit(40);

  const ids = appts.map((a) => a.id);
  const files = ids.length
    ? await db
        .select({
          id: appointmentFiles.id,
          appointmentId: appointmentFiles.appointmentId,
          fileName: appointmentFiles.fileName,
          sizeBytes: appointmentFiles.sizeBytes,
        })
        .from(appointmentFiles)
        .where(inArray(appointmentFiles.appointmentId, ids))
        .orderBy(asc(appointmentFiles.appointmentId), asc(appointmentFiles.id))
    : [];

  const filesByAppointment = new Map<number, typeof files>();
  for (const f of files) {
    const list = filesByAppointment.get(f.appointmentId) ?? [];
    list.push(f);
    filesByAppointment.set(f.appointmentId, list);
  }

  return (
    <AppShell title="Dokumente" subtitle={`Dienstdokumente • ${customer.name}`}>
      <Card
        title="Dienste"
        description="Hier findest du automatisch erzeugte Dienstdokumente (PDF) zu deinen angeforderten Diensten."
      >
        {!appts.length ? (
          <p className="text-sm text-[color:var(--muted)]">Keine Dienste vorhanden.</p>
        ) : (
          <div className="space-y-3">
            {appts.map((a) => {
              const f = filesByAppointment.get(a.id) ?? [];
              return (
                <div key={a.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/appointments/${a.id}`} className="truncate text-sm font-semibold hover:underline">
                        {a.title}
                      </Link>
                      <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{formatDateTime(a.startAt)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!a.approved ? <Badge tone="danger">Noch nicht freigegeben</Badge> : <Badge tone="accent">Freigegeben</Badge>}
                        <Badge tone="muted">{a.staffingStatus}</Badge>
                        <Badge tone="muted">{f.length} Datei(en)</Badge>
                      </div>
                    </div>
                  </div>

                  {f.length ? (
                    <ul className="mt-3 space-y-2">
                      {f.map((file) => (
                        <li
                          key={file.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{file.fileName}</p>
                            <p className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">
                              {Math.round((file.sizeBytes || 0) / 1024)} KB
                            </p>
                          </div>
                          <a
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                            href={`/api/appointments/files/${file.id}/download`}
                          >
                            Download
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[color:var(--muted)]">Noch kein Dokument vorhanden.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
