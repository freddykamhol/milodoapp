const FIELD_LABELS: Record<string, string> = {
  targetGroup: "Zielgruppe",
  trainingDate: "Wunschtermin",
  trainingLocation: "Schulungsort",
  participantCount: "Anzahl der Teilnehmenden",
  eventType: "Art der Veranstaltung",
  eventDate: "Veranstaltungsdatum",
  eventLocation: "Veranstaltungsort",
  attendees: "Teilnehmerzahl",
  eventDuration: "Veranstaltungsdauer",
  shiftDateFrom: "Einsatzzeitraum von",
  shiftDateTo: "Einsatzzeitraum bis",
  shiftLocation: "Einsatzort",
  qualification: "Benötigte Qualifikation",
  staffCount: "Anzahl der Einsatzkräfte",
  firstName: "Vorname",
  lastName: "Nachname",
  phone: "Telefonnummer",
  email: "E-Mail-Adresse",
  company: "Unternehmen",
  message: "Nachricht",
  details: "Weitere Angaben",
  privacyConsent: "Datenschutzerklärung akzeptiert",
  sourceUrl: "Ursprungsseite",
};

const MODE_LABELS: Record<string, string> = {
  kontakt: "Allgemeine Kontaktanfrage",
  eh: "Erste-Hilfe-Ausbildung",
  sanitaet: "Sanitätsdienst",
  boerse: "Personalbörse",
};

export function requestTypeLabel(mode: string) {
  const normalized = mode.trim().toLowerCase();
  return (MODE_LABELS[normalized] ?? humanizeFieldKey(mode)) || "Kontaktanfrage";
}

export function fieldLabel(key: string) {
  const normalized = key.trim();
  if (!normalized) return "Weitere Angabe";
  return FIELD_LABELS[normalized] ?? humanizeFieldKey(normalized);
}

function humanizeFieldKey(key: string) {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "Weitere Angabe";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function displayFieldValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  return String(value);
}
