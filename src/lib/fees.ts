import { db } from "@/lib/db";

type Kind = "QUAL_RD" | "QUAL_AUSB";

export async function getEffectiveHourlyRateCentsForUser({
  userId,
  kind,
  value,
}: {
  userId: number;
  kind: Kind;
  value: string;
}): Promise<number | null> {
  const user = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  if (!user) return null;

  if (kind === "QUAL_RD" && user.hourlyRateQualRdCents != null) return user.hourlyRateQualRdCents;
  if (kind === "QUAL_AUSB" && user.hourlyRateQualAusbCents != null) return user.hourlyRateQualAusbCents;

  const row = await db.query.feeRates.findFirst({
    where: (t, { and, eq }) => and(eq(t.kind, kind), eq(t.value, value)),
  });
  return row?.hourlyRateCents ?? null;
}
