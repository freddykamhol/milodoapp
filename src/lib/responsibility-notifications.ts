import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { responsibilityRecipients, users, notifications, vehicleMaintenances, vehicles, inventoryItems } from "@/db/schema";
import { db } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notification-email";
import { getAppUrl } from "@/lib/app-url";

type ResponsibilityType = "VEHICLE" | "MATERIAL";

export async function notifyResponsibility(type: ResponsibilityType, input: { title: string; body: string; href: string }) {
  const configured = await db.select().from(responsibilityRecipients).where(eq(responsibilityRecipients.type, type));
  const explicitIds = configured.flatMap(row => row.recipientType === "USER" && row.userId ? [row.userId] : []);
  const roleValues = configured.flatMap(row => row.recipientType === "ROLE" && row.role ? [row.role] : []);
  const roleUsers = roleValues.length ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.role, roleValues)) : [];
  const directUsers = explicitIds.length ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, explicitIds)) : [];
  const emailRecipients = configured.flatMap(row => row.recipientType === "EMAIL" && row.email ? [row.email] : []);
  const people = [...new Map([...roleUsers, ...directUsers].map(person => [person.id, person])).values()];
  for (const recipient of people) {
    await db.insert(notifications).values({ scope: "USER", userId: recipient.id, kind: "SYSTEM", title: input.title, body: input.body, href: input.href });
    if (recipient.email) void sendNotificationEmail({ to: recipient.email, subject: `[MILODO] ${input.title}`, preheader: input.title, title: input.title, intro: input.body, button: { label: "Öffnen", url: `${getAppUrl()}${input.href}` } }).catch(() => null);
  }
  for (const email of emailRecipients) void sendNotificationEmail({ to: email, subject: `[MILODO] ${input.title}`, preheader: input.title, title: input.title, intro: input.body, button: { label: "Öffnen", url: `${getAppUrl()}${input.href}` } }).catch(() => null);
}

export async function ensureResponsibilityIntervalNotifications(userId: number) {
  const now = new Date();
  const monthStart = new Date(now.getTime() + 29 * 86400000);
  const monthEnd = new Date(now.getTime() + 31 * 86400000);
  const twoWeekStart = new Date(now.getTime() + 13 * 86400000);
  const twoWeekEnd = new Date(now.getTime() + 15 * 86400000);
  const assignments = await db.select({ type: responsibilityRecipients.type, recipientType: responsibilityRecipients.recipientType, role: responsibilityRecipients.role, userId: responsibilityRecipients.userId }).from(responsibilityRecipients);
  const viewer = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true } });
  const types = new Set(assignments.filter(row => (row.recipientType === "USER" && row.userId === userId) || (row.recipientType === "ROLE" && row.role === viewer?.role)).map(row => row.type));
  const due: Array<{ title: string; body: string; href: string; key: string }> = [];
  if (types.has("VEHICLE")) {
    const rows = await db.select({ id: vehicleMaintenances.id, title: vehicleMaintenances.title, nextAt: vehicleMaintenances.nextAt, plate: vehicles.licensePlate }).from(vehicleMaintenances).innerJoin(vehicles, eq(vehicleMaintenances.vehicleId, vehicles.id)).where(or(and(gte(vehicleMaintenances.nextAt, monthStart), lte(vehicleMaintenances.nextAt, monthEnd)), and(gte(vehicleMaintenances.nextAt, twoWeekStart), lte(vehicleMaintenances.nextAt, twoWeekEnd))));
    due.push(...rows.map(row => ({ title: "Fahrzeugintervall fällig", body: `${row.plate} · ${row.title} am ${row.nextAt.toLocaleDateString("de-DE")}`, href: `/vehicles/${row.id}`, key: `vehicle-${row.id}-${row.nextAt.toISOString()}` })));
  }
  if (types.has("MATERIAL")) {
    const rows = await db.select({ id: inventoryItems.id, name: inventoryItems.name, nextAt: inventoryItems.nextInspectionAt }).from(inventoryItems).where(and(or(and(gte(inventoryItems.nextInspectionAt, monthStart), lte(inventoryItems.nextInspectionAt, monthEnd)), and(gte(inventoryItems.nextInspectionAt, twoWeekStart), lte(inventoryItems.nextInspectionAt, twoWeekEnd)))));
    due.push(...rows.filter(row => row.nextAt).map(row => ({ title: "Materialprüfung fällig", body: `${row.name} am ${row.nextAt!.toLocaleDateString("de-DE")}`, href: `/inventory/items/${row.id}`, key: `material-${row.id}-${row.nextAt!.toISOString()}` })));
  }
  for (const item of due) {
    const existing = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.title, item.title), eq(notifications.href, item.href), eq(notifications.body, item.body))).limit(1);
    if (existing.length) continue;
    await db.insert(notifications).values({ scope: "USER", userId, kind: "SYSTEM", title: item.title, body: item.body, href: item.href });
    const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
    if (user?.email) void sendNotificationEmail({ to: user.email, subject: `[MILODO] ${item.title}`, preheader: item.title, title: item.title, intro: item.body, button: { label: "Öffnen", url: `${getAppUrl()}${item.href}` } }).catch(() => null);
  }
}
