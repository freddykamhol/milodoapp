export type RdQual = "SAN" | "RH" | "RS" | "RA" | "NFS";
export type AusbQual = "AUSBILDER";

const rdOrder: RdQual[] = ["SAN", "RH", "RS", "RA", "NFS"];

export function allowedRdQuals(qualRD: string | null | undefined): RdQual[] {
  if (!qualRD) return [];
  const idx = rdOrder.indexOf(qualRD as RdQual);
  if (idx < 0) return [];
  return rdOrder.slice(0, idx + 1);
}

export function allowedAusbQuals({
  qualRD,
  qualAusb,
}: {
  qualRD: string | null | undefined;
  qualAusb: string | null | undefined;
}): AusbQual[] {
  // EH-Ausbilder soll nur dann greifen, wenn keine RD-Qualifikation vorhanden ist.
  if (qualRD) return [];
  if (qualAusb === "AUSBILDER") return ["AUSBILDER"];
  return [];
}

