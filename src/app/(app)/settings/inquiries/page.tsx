import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { contactInquiryRecipients, users } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { inquiryTypes } from "@/lib/contact-inquiry-recipients";
import { InquiryRecipientsClient } from "./_components/inquiry-recipients-client";

export default async function InquirySettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") notFound();

  const [recipients, memberRows] = await Promise.all([
    db.select().from(contactInquiryRecipients),
    db.select({ id: users.id, username: users.username, email: users.email, role: users.role }).from(users),
  ]);
  const initial = inquiryTypes.map((type) => ({
    ...type,
    recipients: recipients.filter((recipient) => recipient.mode === type.mode).map((recipient) => ({
      type: recipient.recipientType,
      originMode: recipient.originMode,
      role: recipient.role,
      userId: recipient.userId,
      email: recipient.email,
    })),
  }));
  const members = memberRows.filter((user) => ["ADMIN", "VERWALTUNG", "PERSONAL", "KUNDE"].includes(user.role))
    .map((user) => ({ ...user, email: user.email ?? "" })) as Array<{ id: number; username: string; email: string; role: "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE" }>;

  return <InquiryRecipientsClient initial={initial} users={members} />;
}
