import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

import { FeesClient } from "./_components/fees-client";

export default async function FeesSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!(viewer.role === "ADMIN" || viewer.role === "VERWALTUNG")) notFound();

  const rdQuals = ["SAN", "RH", "RS", "RA", "NFS"];
  const ausbQuals = ["AUSBILDER"];

  const rows = await db.query.feeRates.findMany({
    orderBy: (t, { asc }) => [asc(t.kind), asc(t.value)],
  });

  return (
    <FeesClient
      rdQuals={rdQuals}
      ausbQuals={ausbQuals}
      initial={rows.map((r) => ({
        kind: r.kind,
        value: r.value,
        hourlyRateCents: r.hourlyRateCents ?? null,
      }))}
    />
  );
}
