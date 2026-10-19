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

export function matchesAppointmentRequirements(
  user: { role: string; qualRD: string | null; qualAusb: string | null },
  requirements: Array<{ kind: string; value: string }>,
) {
  if (user.role === "ADMIN" || user.role === "VERWALTUNG" || requirements.length === 0) return true;

  const rdValues = allowedRdQuals(user.qualRD);
  const ausbValues = allowedAusbQuals({ qualRD: user.qualRD, qualAusb: user.qualAusb });
  return requirements.some((requirement) => (
    requirement.kind === "QUAL_RD" && rdValues.includes(requirement.value as RdQual)
  ) || (
    requirement.kind === "QUAL_AUSB" && ausbValues.includes(requirement.value as AusbQual)
  ));
}

