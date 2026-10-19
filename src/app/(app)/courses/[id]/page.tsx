import { notFound, redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getViewer } from "@/lib/viewer";
import { CourseError, loadCourse } from "@/lib/courses";
import { AppShell } from "../../_components/app-shell";
import { CourseDetails } from "../course-details";
import { CourseStaffing } from "../course-staffing";
import { CourseEdit } from "../course-edit";
import { db } from "@/lib/db";
import { customers } from "@/db/schema";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  let data;
  try {
    data = await loadCourse(Number((await params).id), viewer);
  } catch (error) {
    if (error instanceof CourseError) {
      if (error.status === 403) redirect("/courses");
      notFound();
    }
    throw error;
  }
  const customerRows = data.canManage ? await db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(asc(customers.name)) : [];
  return <AppShell title={data.title} subtitle="Kursdaten, Teilnehmerverwaltung, Helfereinteilung und Exporte">{data.canStaff ? <CourseStaffing courseId={data.id} canOperate={data.canOperate} canStaff={data.canStaff} course={{ title: data.title, startAt: data.startAt, endAt: data.endAt, location: data.location, courseType: data.courseType, state: data.state, approved: data.approved, staffingStatus: data.staffingStatus }} /> : null}<CourseEdit data={data} customers={customerRows} canEdit={data.canManage} /><CourseDetails initialData={data} /></AppShell>;
}
