import { notFound, redirect } from "next/navigation";

import { documentExpiryPreferences, documentExpiryRecipients, documentExpirySettings, users } from "@/db/schema";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

import { DocumentsSettingsClient } from "./_components/documents-settings-client";

const definitions = [
  { category: "TRAINING" as const, label: "Aus- und Fortbildungsnachweise" },
  { category: "DRIVER_LICENSE" as const, label: "Fahrerlaubnisse" },
  { category: "QUALIFICATION" as const, label: "Qualifikationen" },
];

export default async function DocumentsSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") notFound();
  for (const definition of definitions) {
    await db.insert(documentExpirySettings).values({ category: definition.category }).onConflictDoNothing();
    const existing = await db.query.documentExpiryRecipients.findFirst({ where: (t, { eq }) => eq(t.category, definition.category) });
    if (!existing) {
      await db.insert(documentExpiryRecipients).values([
        { category: definition.category, recipientType: "ROLE", role: "ADMIN" },
        { category: definition.category, recipientType: "ROLE", role: "VERWALTUNG" },
      ]);
    }
  }
  const rows = await db.query.documentExpirySettings.findMany();
  await db.insert(documentExpiryPreferences).values({ id: 1 }).onConflictDoNothing();
  const preferences = await db.query.documentExpiryPreferences.findFirst({ where: (t, { eq }) => eq(t.id, 1) });
  const recipients = await db.query.documentExpiryRecipients.findMany();
  const memberRows = await db.select({ id: users.id, username: users.username, email: users.email, role: users.role }).from(users);
  return <DocumentsSettingsClient manualExpiryRequiresApproval={preferences?.manualExpiryRequiresApproval ?? false} initial={definitions.map((definition) => ({
    ...definition,
    ...rows.find((row) => row.category === definition.category),
    recipients: recipients.filter((recipient) => recipient.category === definition.category).map((recipient) => ({
      type: recipient.recipientType,
      role: recipient.role,
      userId: recipient.userId,
      email: recipient.email,
      originCategory: recipient.originCategory,
    })),
  }))} users={memberRows.filter((user) => ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"].includes(user.role)).map((user) => ({ ...user, email: user.email ?? "" })) as Array<{ id: number; username: string; email: string; role: "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE" }>} />;
}
