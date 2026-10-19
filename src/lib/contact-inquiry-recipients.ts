import { asc, eq, inArray } from "drizzle-orm";

import { contactInquiryRecipients, users } from "@/db/schema";
import { db } from "@/lib/db";

export const inquiryTypes = [
  { mode: "eh", label: "EH-Ausbildung", description: "Betriebliche Kurse & Inhouse" },
  { mode: "notfall", label: "Notfalltraining", description: "Praxis, Pflege & Teams" },
  { mode: "sanitaet", label: "Sanit\u00e4tsdienst", description: "Events, Firmen & Sport" },
  { mode: "boerse", label: "Personalvermittlung", description: "Schichten & kurzfristige Besetzung" },
  { mode: "kontakt", label: "Kontakt", description: "Allgemeine Anfrage" },
] as const;

export type ContactInquiryMode = (typeof inquiryTypes)[number]["mode"];
export type ContactInquiryRecipientInsert = typeof contactInquiryRecipients.$inferInsert;

export function normalizeContactInquiryMode(value: string): ContactInquiryMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === "eh") return "eh";
  if (normalized === "notfall" || normalized === "notfalltraining") return "notfall";
  if (normalized === "sanitaet" || normalized === "sanitaetsdienst") return "sanitaet";
  if (normalized === "boerse" || normalized === "personalvermittlung") return "boerse";
  return "kontakt";
}

export async function getContactInquiryRecipientEmails(mode: ContactInquiryMode) {
  const recipients = await db.select().from(contactInquiryRecipients)
    .where(eq(contactInquiryRecipients.mode, mode)).orderBy(asc(contactInquiryRecipients.id));
  const roles = recipients.flatMap((recipient) => recipient.recipientType === "ROLE" && recipient.role ? [recipient.role] : []);
  const userIds = recipients.flatMap((recipient) => recipient.recipientType === "USER" && recipient.userId ? [recipient.userId] : []);
  const roleUsers = roles.length ? await db.select({ email: users.email }).from(users).where(inArray(users.role, roles)) : [];
  const selectedUsers = userIds.length ? await db.select({ email: users.email }).from(users).where(inArray(users.id, userIds)) : [];
  const explicit = recipients.flatMap((recipient) => recipient.recipientType === "EMAIL" && recipient.email ? [recipient.email] : []);
  return Array.from(new Set([...roleUsers, ...selectedUsers]
    .map((user) => user.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email))
    .concat(explicit.map((email) => email.trim().toLowerCase()))));
}
