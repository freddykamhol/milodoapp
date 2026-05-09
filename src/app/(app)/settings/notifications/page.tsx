import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { notificationPrefs } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

import { NotificationsClient } from "./_components/notifications-client";

const staffKeys = [
  "NEW_SHIFT",
  "SHIFT_CHANGE",
  "URGENT_REQUESTS",
  "REQUESTS_GENERAL",
  "SHIFT_REMINDER",
  "TIMESHEET",
  "BIRTHDAY",
  "CUSTOMER_REQUEST",
] as const;

const customerKeys = [
  "CUSTOMER_SHIFT_RELEASED",
  "CUSTOMER_SHIFT_FILLED",
  "CUSTOMER_SHIFT_UNFILLED_2D",
] as const;

export default async function NotificationsSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const keys = viewer.role === "KUNDE" ? customerKeys : staffKeys;

  for (const key of keys) {
    await db.insert(notificationPrefs).values({ userId: viewer.id, key }).onConflictDoNothing();
  }

  const rows = await db.query.notificationPrefs.findMany({
    where: (t, { and, eq, inArray }) => and(eq(t.userId, viewer.id), inArray(t.key, keys)),
    orderBy: (t, { asc }) => [asc(t.key)],
  });

  return (
    <NotificationsClient
      definitions={
        viewer.role === "KUNDE"
          ? [
              {
                key: "CUSTOMER_SHIFT_RELEASED",
                label: "Dienst freigegeben",
                description: "Wenn ein angeforderter Dienst freigegeben wurde.",
                category: "Dienste",
              },
              {
                key: "CUSTOMER_SHIFT_FILLED",
                label: "Dienst besetzt",
                description: "Wenn ein freigegebener Dienst vollständig besetzt ist.",
                category: "Dienste",
              },
              {
                key: "CUSTOMER_SHIFT_UNFILLED_2D",
                label: "Nicht besetzt (2 Tage)",
                description: "Wenn ein freigegebener Dienst 2 Tage vorher noch nicht besetzt ist.",
                category: "Dienste",
              },
            ]
          : [
              {
                key: "NEW_SHIFT",
                label: "Neuer Dienst",
                description: "Wenn ein neuer Dienst verfügbar ist.",
                category: "Dienste",
              },
              {
                key: "SHIFT_CHANGE",
                label: "Dienständerung",
                description: "Wenn Start/Ende/Ort eines Dienstes geändert wird.",
                category: "Dienste",
              },
              {
                key: "URGENT_REQUESTS",
                label: "Akutabfragen",
                description: "Bei kurzfristigen, dringend zu besetzenden Abfragen.",
                category: "Dienste",
              },
              {
                key: "REQUESTS_GENERAL",
                label: "Abfragen allgemein",
                description: "Allgemeine Abfragen ohne akuten Charakter.",
                category: "Dienste",
              },
              {
                key: "CUSTOMER_REQUEST",
                label: "Kundenanforderung",
                description: "Wenn ein Kunde einen Dienst anfordert.",
                category: "Dienste",
              },
              {
                key: "SHIFT_REMINDER",
                label: "Diensterinnerung",
                description: "Erinnerung vor einem zugesagten Dienst.",
                category: "Dienste",
                hasDaysBefore: true,
              },
              {
                key: "TIMESHEET",
                label: "Stundenzettel",
                description: "Hinweise zu Monatsabschluss/Freigaben.",
                category: "Stunden",
              },
              {
                key: "BIRTHDAY",
                label: "Geburtstag",
                description: "Benachrichtigung bei Geburtstagen im Team.",
                category: "Team",
              },
            ]
      }
      initial={rows.map((r) => ({
        key: r.key,
        enabled: r.emailEnabled,
        reminderDaysBefore: r.reminderDaysBefore ?? null,
      }))}
    />
  );
}
