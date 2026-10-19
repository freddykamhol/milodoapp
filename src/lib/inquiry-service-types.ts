export const inquiryServiceTypes = [
  { value: "ERSTE_HILFE", label: "Erste Hilfe" },
  { value: "SANITATSDIENST", label: "Sanitätsdienst" },
  { value: "RD_BOERSE", label: "RD-Personalvermittlung" },
  { value: "RD_KTW", label: "KTW" },
  { value: "RD_NKTW", label: "NKTW" },
  { value: "RD_RTW", label: "RTW" },
  { value: "RD_NEF", label: "NEF" },
  { value: "RD_ITW", label: "ITW" },
  { value: "RD_S_RTW", label: "S-RTW" },
  { value: "RD_SONSTIGES", label: "Sonstige Rettungsdienst-Dienstart" },
] as const;

export type InquiryServiceType = (typeof inquiryServiceTypes)[number]["value"];

const allInquiryServiceTypes = inquiryServiceTypes.map((item) => item.value);

export function parseInquiryServiceTypes(value: string | null | undefined): InquiryServiceType[] {
  if (value == null) return [...allInquiryServiceTypes];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [...allInquiryServiceTypes];
    const selected = allInquiryServiceTypes.filter((item) => parsed.includes(item));
    // Preferences saved before the RD parent option existed stored only RD subtypes.
    if (selected.some((item) => item.startsWith("RD_") && item !== "RD_BOERSE") && !selected.includes("RD_BOERSE")) {
      selected.unshift("RD_BOERSE");
    }
    return selected;
  } catch {
    return [...allInquiryServiceTypes];
  }
}

export function isInquiryServiceEnabled(
  preferences: string | null | undefined,
  bereich: "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE",
  dienstart: string | null | undefined,
) {
  const key: InquiryServiceType = bereich === "ERSTE_HILFE"
    ? "ERSTE_HILFE"
    : bereich === "SANITATSDIENST"
      ? "SANITATSDIENST"
      : `RD_${["KTW", "NKTW", "RTW", "NEF", "ITW", "S_RTW"].includes(dienstart ?? "") ? dienstart : "SONSTIGES"}` as InquiryServiceType;
  const selected = parseInquiryServiceTypes(preferences);
  if (bereich === "RD_BOERSE") return selected.includes("RD_BOERSE") && selected.includes(key);
  return selected.includes(key);
}
