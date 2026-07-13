import { AppShell } from "../_components/app-shell";
import { db } from "@/lib/db";
import { memberRegistrationSubmissions } from "@/db/schema";
import { MembersClient, type MemberItem } from "./_components/members-client";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

export default async function MembersPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "KUNDE") notFound();

  const membersRaw = await db.query.users.findMany({
    orderBy: (t, { asc }) => [asc(t.role), asc(t.username)],
  });

  const members = viewer.role === "PERSONAL" ? membersRaw.filter((m) => m.role !== "KUNDE") : membersRaw;

  const canViewAll = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const pendingRegistrations = canViewAll
    ? await db.query.memberRegistrationSubmissions.findMany({
        where: (t, { eq }) => eq(t.status, "PENDING"),
        columns: { userId: true },
      })
    : [];
  const pendingRegistrationIds = new Set(pendingRegistrations.map((registration) => registration.userId));

  const items: MemberItem[] = members.map((m) => ({
    id: m.id,
    username: m.username,
    firstName: canViewAll || viewer.id === m.id || Boolean(m.publicFirstName) ? (m.firstName ?? "") : "",
    lastName: canViewAll || viewer.id === m.id || Boolean(m.publicLastName) ? (m.lastName ?? "") : "",
    role: m.role,
    geb: canViewAll || viewer.id === m.id || Boolean(m.publicGeb) ? (m.geb ? m.geb.toISOString() : null) : null,
    qualRD: canViewAll || viewer.id === m.id || Boolean(m.publicQualifications) ? (m.qualRD ?? null) : null,
    qualAusb: canViewAll || viewer.id === m.id || Boolean(m.publicQualifications) ? (m.qualAusb ?? null) : null,
    einsatzort: canViewAll || viewer.id === m.id || Boolean(m.publicQualifications) ? (m.einsatzort ?? null) : null,
    locked: m.locked ?? false,
    pendingRegistration: pendingRegistrationIds.has(m.id),
  }));

  const canCreate = viewer.role === "ADMIN";
  const canManage = viewer.role === "ADMIN";

  return (
    <AppShell title="Mitglieder" subtitle="Übersicht über alle Mitglieder und Qualifikationen.">
      <MembersClient members={items} canCreate={canCreate} canManage={canManage} />
    </AppShell>
  );
}
