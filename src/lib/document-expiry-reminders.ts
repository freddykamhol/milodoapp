import { and, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";

import { documentExpiryRecipients, documentExpirySettings, documents, users } from "@/db/schema";
import { db } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notification-email";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

function due(lastSentAt: Date | null, now: Date) {
  return !lastSentAt || now.getTime() - lastSentAt.getTime() >= WEEK;
}

export async function sendDocumentExpiryReminders(now = new Date()) {
  const settings = await db.select().from(documentExpirySettings).where(gte(documentExpirySettings.reminderDaysBefore, 1));
  let considered = 0;
  let sent = 0;

  for (const setting of settings) {
    const rows = await db
      .select({ document: documents, owner: users })
      .from(documents)
      .innerJoin(users, eq(documents.ownerId, users.id))
      .where(and(
        eq(documents.category, setting.category),
        isNotNull(documents.expiresAt),
        or(
          and(gte(documents.expiresAt, now), lte(documents.expiresAt, new Date(now.getTime() + setting.reminderDaysBefore * DAY))),
          lte(documents.expiresAt, now),
        ),
      ));
    const recipients = await db.query.documentExpiryRecipients.findMany({ where: (t, { eq }) => eq(t.category, setting.category) });
    const roleRecipients = recipients.filter((item) => item.recipientType === "ROLE" && item.role);
    const userIds = recipients.flatMap((item) => item.recipientType === "USER" && item.userId ? [item.userId] : []);
    const roleUsers = roleRecipients.length
      ? await db.select({ email: users.email }).from(users).where(inArray(users.role, roleRecipients.map((item) => item.role!)))
      : [];
    const selectedUsers = userIds.length ? await db.select({ email: users.email }).from(users).where(inArray(users.id, userIds)) : [];
    const explicitEmails = recipients.flatMap((item) => item.recipientType === "EMAIL" && item.email ? [item.email] : []);
    const configuredEmails = Array.from(new Set([...roleUsers, ...selectedUsers]
      .map((item) => item.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email))
      .concat(explicitEmails.map((email) => email.trim().toLowerCase()))));

    for (const row of rows) {
      considered += 1;
      const expiresAt = row.document.expiresAt!;
      const isExpired = expiresAt.getTime() < now.getTime();
      const ownerEmail = row.owner.email?.trim().toLowerCase();
      const distinctConfiguredEmails = ownerEmail ? configuredEmails.filter((email) => email !== ownerEmail) : configuredEmails;
      const configuredSentAt = isExpired ? row.document.expiredReminderSentAt : row.document.expiryReminderSentAt;
      const ownerSentAt = isExpired ? row.document.ownerExpiredReminderSentAt : row.document.ownerExpiryReminderSentAt;
      const configuredDue = distinctConfiguredEmails.length > 0 && (isExpired ? due(configuredSentAt, now) : !configuredSentAt);
      const ownerDue = isExpired ? due(ownerSentAt, now) : !ownerSentAt;
      if (!configuredDue && !ownerDue) continue;

      const subject = isExpired ? `Dokument abgelaufen: ${row.document.title}` : `Dokument läuft bald ab: ${row.document.title}`;
      const title = isExpired ? "Dokument ist abgelaufen" : "Dokument läuft bald ab";
      const intro = isExpired
        ? `Das Dokument von ${row.owner.username} ist abgelaufen. Diese Erinnerung wird wöchentlich erneut gesendet, bis das Dokument aktualisiert wurde.`
        : `Das Dokument von ${row.owner.username} erreicht bald sein Ablaufdatum.`;
      const emailContent = {
        subject,
        preheader: "Dokumentenablauf",
        title,
        intro,
        sections: [
          { label: "Dokument", value: row.document.title },
          { label: "Mitglied", value: row.owner.username },
          { label: "Gültig bis", value: expiresAt.toLocaleDateString("de-DE") },
        ],
        footerNote: "Diese Nachricht wurde automatisch von milodo versendet.",
      };

      let ownerDelivered = false;
      let configuredDelivered = false;
      if (ownerDue) {
        if (ownerEmail) {
          ownerDelivered = (await sendNotificationEmail({ to: ownerEmail, ...emailContent })).ok;
        } else {
          console.warn(`[document-expiry] owner ${row.owner.id} has no email; cannot send document ${row.document.id} reminder`);
        }
      }
      if (configuredDue) {
        let allDelivered = distinctConfiguredEmails.length > 0;
        for (const email of distinctConfiguredEmails) {
          const result = await sendNotificationEmail({ to: email, ...emailContent });
          if (!result.ok) allDelivered = false;
        }
        configuredDelivered = allDelivered;
      }

      const update: Partial<typeof documents.$inferInsert> = { updatedAt: now };
      if (ownerDelivered) {
        if (isExpired) update.ownerExpiredReminderSentAt = now;
        else update.ownerExpiryReminderSentAt = now;
      }
      if (configuredDelivered) {
        if (isExpired) update.expiredReminderSentAt = now;
        else update.expiryReminderSentAt = now;
      }
      if (ownerDelivered || configuredDelivered) {
        await db.update(documents).set(update).where(eq(documents.id, row.document.id));
        sent += 1;
      }
    }
  }
  return { considered, sent };
}
