import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../_components/app-shell";
import { Badge, Card } from "../../_components/ui";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export default async function MemberDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "KUNDE") notFound();

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) notFound();

  const member = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  if (!member) notFound();
  if (viewer.role === "PERSONAL" && member.role === "KUNDE") notFound();

  const canViewAll = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG" || viewer.id === member.id;

  const showFirstName = canViewAll || Boolean(member.publicFirstName);
  const showLastName = canViewAll || Boolean(member.publicLastName);
  const showGeb = canViewAll || Boolean(member.publicGeb);
  const showQualifications = canViewAll || Boolean(member.publicQualifications);
  const showAddress = canViewAll || Boolean(member.publicAddress);
  const showContact = canViewAll || Boolean(member.publicContact);

  const displayFirstName = showFirstName ? (member.firstName || "").trim() : "";
  const displayLastName = showLastName ? (member.lastName || "").trim() : "";
  const displayName = `${displayFirstName} ${displayLastName}`.trim() || "Mitglied";

  return (
    <AppShell
      title={displayName}
      subtitle={canViewAll ? `@${member.username}` : "Mitgliedsdetails"}
    >
      <Card
        title="Details"
        description={canViewAll ? "Du siehst alle Felder (Admin/Verwaltung)." : "Sichtbar nach Freigabe durch das Mitglied."}
        actions={
          <Link href="/members" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
            Zurück
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nachname" value={showLastName ? member.lastName || "—" : "—"} />
          <Field label="Vorname" value={showFirstName ? member.firstName || "—" : "—"} />
          <Field label="Geburtstag" value={showGeb && member.geb ? formatDate(member.geb.toISOString()) : "—"} />
          <Field label="Rolle" value={member.role} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Qualifikation RD" value={showQualifications ? member.qualRD ?? "—" : "—"} />
          <Field label="Qualifikation Ausbildung" value={showQualifications ? member.qualAusb ?? "—" : "—"} />
          <Field label="Einsatzort" value={showQualifications ? member.einsatzort ?? "—" : "—"} />
          {canViewAll ? (
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Username</span>
              <Badge tone="muted">@{member.username}</Badge>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="E-Mail" value={showContact ? member.email ?? "—" : "—"} />
          <Field label="Telefon" value={showContact ? member.telefon ?? "—" : "—"} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Straße" value={showAddress ? member.strasse ?? "—" : "—"} />
          <Field label="Hausnummer" value={showAddress ? member.hausnummer ?? "—" : "—"} />
          <Field label="PLZ" value={showAddress ? member.plz ?? "—" : "—"} />
          <Field label="Ort" value={showAddress ? member.ort ?? "—" : "—"} />
          <Field label="Ortergänzung" value={showAddress ? member.ortErgaenzung ?? "—" : "—"} />
        </div>
      </Card>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}
