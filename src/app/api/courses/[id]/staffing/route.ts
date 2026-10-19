import {asc, eq} from 'drizzle-orm';
import {NextResponse} from 'next/server';
import {appointmentApplications, users} from '@/db/schema';
import {courseRoute} from '@/lib/course-route';
import {db} from '@/lib/db';

export const GET = courseRoute(async (_request, {row, canStaff}, viewer) => {
  const applications = canStaff
    ? await db.select({userId: appointmentApplications.userId, username: users.username, role: users.role, qualRD: users.qualRD, qualAusb: users.qualAusb, status: appointmentApplications.status, appRole: appointmentApplications.role, adminNote: appointmentApplications.adminNote})
        .from(appointmentApplications).innerJoin(users, eq(appointmentApplications.userId, users.id)).where(eq(appointmentApplications.appointmentId, row.id)).orderBy(asc(users.username))
    : [];
  const members = viewer.role === 'ADMIN' || viewer.role === 'VERWALTUNG'
    ? await db.select({id: users.id, username: users.username, role: users.role, qualRD: users.qualRD, qualAusb: users.qualAusb, locked: users.locked}).from(users).where(eq(users.locked, false)).orderBy(asc(users.username))
    : [];
  const viewerApplication = applications.find(application => application.userId === viewer.id) ?? null;
  return NextResponse.json({canAdmin: viewer.role === 'ADMIN' || viewer.role === 'VERWALTUNG', canReport: viewer.role === 'PERSONAL' && row.approved && row.state === 'OPEN' && row.staffingStatus !== 'BESETZT' && viewerApplication?.status !== 'CONFIRMED' && viewerApplication?.status !== 'REPORTED', viewerApplication, applications, members}, {headers: {'cache-control': 'no-store'}});
}, 'read');
