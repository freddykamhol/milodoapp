import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { rolePermissions } from "@/db/schema";
import { db } from "@/lib/db";
import { RolesSettingsClient } from "./client";

const permissions = ["DASHBOARD_VIEW", "CALENDAR_VIEW", "CALENDAR_EXPORT", "APPOINTMENTS_VIEW", "APPOINTMENTS_CREATE", "APPOINTMENTS_EDIT", "APPOINTMENTS_DELETE", "APPOINTMENTS_ASSIGN", "COURSES_VIEW", "COURSES_CREATE", "COURSES_EDIT", "COURSES_PARTICIPANTS", "COURSES_EXPORT", "VEHICLES_VIEW", "VEHICLES_CREATE", "VEHICLES_EDIT", "VEHICLES_DEFECTS_VIEW", "VEHICLES_DEFECTS_CREATE", "VEHICLES_DEFECTS_EDIT", "VEHICLES_DEFECTS_DELETE", "VEHICLES_MAINTENANCE_VIEW", "VEHICLES_MAINTENANCE_EDIT", "MATERIAL_VIEW", "MATERIAL_CREATE", "MATERIAL_EDIT", "MATERIAL_DEFECTS_VIEW", "MATERIAL_DEFECTS_CREATE", "MATERIAL_DEFECTS_EDIT", "MATERIAL_DEFECTS_DELETE", "MATERIAL_INSPECTIONS_VIEW", "MATERIAL_INSPECTIONS_EDIT", "MEMBERS_VIEW", "MEMBERS_CREATE", "MEMBERS_EDIT", "MEMBERS_DELETE", "MEMBERS_PASSWORD", "MEMBERS_PERSONNEL_FILE", "DOCUMENTS_VIEW", "DOCUMENTS_UPLOAD", "DOCUMENTS_DELETE", "DOCUMENTS_APPROVE", "HOURS_VIEW", "HOURS_EDIT", "HOURS_EXPORT", "HOURS_CLOSE", "HOURS_REOPEN", "CUSTOMERS_VIEW", "CUSTOMERS_EDIT", "SETTINGS_VIEW", "SETTINGS_EDIT"] as const;
const roles = ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"] as const;

function defaults(role: typeof roles[number], permission: typeof permissions[number]) {
  if (role === "ADMIN") return { canView: true, canManage: true };
  if (role === "VERWALTUNG") return { canView: true, canManage: !["MEMBERS_DELETE", "SETTINGS_EDIT", "HOURS_REOPEN"].includes(permission) };
  if (role === "PERSONAL") {
    const canView = ["DASHBOARD_VIEW", "CALENDAR_VIEW", "APPOINTMENTS_VIEW", "COURSES_VIEW", "VEHICLES_VIEW", "VEHICLES_DEFECTS_VIEW", "MATERIAL_VIEW", "MATERIAL_DEFECTS_VIEW", "MATERIAL_INSPECTIONS_VIEW", "DOCUMENTS_VIEW", "HOURS_VIEW"].includes(permission);
    const canManage = ["VEHICLES_DEFECTS_CREATE", "MATERIAL_DEFECTS_CREATE"].includes(permission);
    return { canView: canView || canManage, canManage };
  }
  const canView = ["DASHBOARD_VIEW", "CALENDAR_VIEW", "APPOINTMENTS_VIEW", "COURSES_VIEW", "DOCUMENTS_VIEW"].includes(permission);
  return { canView, canManage: false };
}

export default async function RolesSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") notFound();
  const existing = await db.select().from(rolePermissions);
  const missing = roles.flatMap(role => permissions.filter(permission => !existing.some(row => row.role === role && row.permission === permission)).map(permission => ({ role, permission, ...defaults(role, permission), updatedAt: new Date() })));
  if (missing.length) await db.insert(rolePermissions).values(missing);
  return <RolesSettingsClient initial={await db.select().from(rolePermissions)} />;
}
