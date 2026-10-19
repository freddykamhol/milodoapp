import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { rolePermissions } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
const roles = ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"] as const;
const permissions = ["DASHBOARD_VIEW", "CALENDAR_VIEW", "CALENDAR_EXPORT", "APPOINTMENTS_VIEW", "APPOINTMENTS_CREATE", "APPOINTMENTS_EDIT", "APPOINTMENTS_DELETE", "APPOINTMENTS_ASSIGN", "COURSES_VIEW", "COURSES_CREATE", "COURSES_EDIT", "COURSES_PARTICIPANTS", "COURSES_EXPORT", "VEHICLES_VIEW", "VEHICLES_CREATE", "VEHICLES_EDIT", "VEHICLES_DEFECTS_VIEW", "VEHICLES_DEFECTS_CREATE", "VEHICLES_DEFECTS_EDIT", "VEHICLES_DEFECTS_DELETE", "VEHICLES_MAINTENANCE_VIEW", "VEHICLES_MAINTENANCE_EDIT", "MATERIAL_VIEW", "MATERIAL_CREATE", "MATERIAL_EDIT", "MATERIAL_DEFECTS_VIEW", "MATERIAL_DEFECTS_CREATE", "MATERIAL_DEFECTS_EDIT", "MATERIAL_DEFECTS_DELETE", "MATERIAL_INSPECTIONS_VIEW", "MATERIAL_INSPECTIONS_EDIT", "MEMBERS_VIEW", "MEMBERS_CREATE", "MEMBERS_EDIT", "MEMBERS_DELETE", "MEMBERS_PASSWORD", "MEMBERS_PERSONNEL_FILE", "DOCUMENTS_VIEW", "DOCUMENTS_UPLOAD", "DOCUMENTS_DELETE", "DOCUMENTS_APPROVE", "HOURS_VIEW", "HOURS_EDIT", "HOURS_EXPORT", "HOURS_CLOSE", "HOURS_REOPEN", "CUSTOMERS_VIEW", "CUSTOMERS_EDIT", "SETTINGS_VIEW", "SETTINGS_EDIT"] as const;
function allowed(role: string) { return role === "ADMIN" || role === "VERWALTUNG"; }
export async function GET() { const viewer = await getViewer(); if (!viewer) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); return NextResponse.json({ rows: await db.select().from(rolePermissions), roles, permissions }); }
export async function PATCH(request: Request) {
  const viewer = await getViewer(); if (!viewer || !allowed(viewer.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { role?: unknown; permission?: unknown; canView?: unknown; canManage?: unknown } | null;
  const role = String(body?.role ?? ""); const permission = String(body?.permission ?? "");
  if (!roles.includes(role as typeof roles[number]) || !permissions.includes(permission as typeof permissions[number])) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await db.insert(rolePermissions).values({ role: role as typeof roles[number], permission, canView: body?.canView === true, canManage: body?.canManage === true, updatedAt: new Date() }).onConflictDoUpdate({ target: [rolePermissions.role, rolePermissions.permission], set: { canView: body?.canView === true, canManage: body?.canManage === true, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
