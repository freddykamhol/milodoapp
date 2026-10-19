import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { loadCourses } from "@/lib/course-read-model";
import { AppShell } from "../_components/app-shell";
import { CourseList } from "./course-list";

export default async function CoursesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "PERSONAL" && viewer.qualAusb !== "AUSBILDER") redirect("/dashboard");
  const rows = await loadCourses(viewer);
  return <AppShell title="Kurse" subtitle="Erste-Hilfe-Kurse, Teilnehmer und Anwesenheit im Überblick."><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[color:var(--muted)]">{rows.length} Kurse</p>{viewer.role === "ADMIN" || viewer.role === "VERWALTUNG" ? <Link href="/courses/new" className="ui-button-primary">+ Kurs erstellen</Link> : null}</div><CourseList rows={rows.map(row => ({ ...row, startAt: row.startAt.toISOString(), endAt: row.endAt?.toISOString() ?? null }))} /></AppShell>;
}
