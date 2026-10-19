export function serviceAreaLabel(value: string) {
  if (value === "RD_BOERSE") return "RD-Personalvermittlung";
  if (value === "SANITATSDIENST") return "Sanitätsdienst";
  if (value === "ERSTE_HILFE") return "Erste Hilfe";
  return value;
}
