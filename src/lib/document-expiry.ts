import { and, eq, isNull } from "drizzle-orm";

import { documentExpirySettings, documents } from "@/db/schema";
import { db } from "@/lib/db";

export type ExpiringDocumentCategory = "TRAINING" | "DRIVER_LICENSE" | "QUALIFICATION";

export function addCalendarMonths(date: Date, months: number) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const finalDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, finalDay));
  return result;
}

export async function calculateDocumentExpiry(category: string, createdAt = new Date()) {
  if (category !== "TRAINING" && category !== "DRIVER_LICENSE" && category !== "QUALIFICATION") return null;
  const setting = await db.query.documentExpirySettings.findFirst({ where: (t, { eq }) => eq(t.category, category) });
  return setting && setting.expiryMonths > 0 ? addCalendarMonths(createdAt, setting.expiryMonths) : null;
}

export async function backfillDocumentExpiryDates() {
  return db.transaction(tx=>{
    const settings=tx.select().from(documentExpirySettings).all();
    let updated=0;
    for(const setting of settings){
      if(setting.expiryMonths<=0)continue;
      const legacyDocs=tx.select({id:documents.id,createdAt:documents.createdAt}).from(documents).where(and(eq(documents.category,setting.category),isNull(documents.expiresAt))).all();
      for(const doc of legacyDocs){
        tx.update(documents).set({expiresAt:addCalendarMonths(doc.createdAt,setting.expiryMonths),updatedAt:new Date()}).where(and(eq(documents.id,doc.id),isNull(documents.expiresAt))).run();
        updated++;
      }
    }
    return updated;
  });
}
