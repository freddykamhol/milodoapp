import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    const parsed = JSON.parse(String(raw ?? ""));
    return parsed as T;
  } catch {
    return fallback;
  }
}

function wrapText({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string;
  font: { widthOfTextAtSize: (t: string, s: number) => number };
  size: number;
  maxWidth: number;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  function pushCurrent() {
    if (current) lines.push(current);
    current = "";
  }

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    pushCurrent();
    current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function renderPersonalfragebogenHonorarPdf({
  questionnaire,
  uploadedCount,
}: {
  questionnaire: {
    id: number;
    createdAt: Date | null;
    firstName: string;
    lastName: string;
    geb: Date | null;
    taxNumber: string;
    street: string;
    houseNumber: string;
    plz: string;
    city: string;
    cityExtra: string;
    phone: string;
    phoneShare: boolean;
    email: string;
    bankAccountHolder: string;
    bankAccountHolderDiffers: boolean;
    bankName: string;
    iban: string;
    blz: string;
    einsatzfelderJson: string;
    qualMed: string | null;
    qualEhAusbilder: boolean;
    sizesJson: string;
    hasNeutralPsa: boolean;
    driverLicencesJson: string;
    hasPss: boolean;
    ownCar: boolean;
    contactPrefsJson: string;
  };
  uploadedCount: number;
}) {
  const einsatzfelder = safeJsonParse<string[]>(questionnaire.einsatzfelderJson ?? null, []);
  const sizes = safeJsonParse<Record<string, string>>(questionnaire.sizesJson ?? null, {});
  const driverLicences = safeJsonParse<string[]>(questionnaire.driverLicencesJson ?? null, []);
  const contactPrefs = safeJsonParse<string[]>(questionnaire.contactPrefsJson ?? null, []);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const page = pdf.addPage(pageSize);
  const { width, height } = page.getSize();

  const margin = 36;
  let y = height - margin;

  const brand = {
    accent: rgb(11 / 255, 121 / 255, 253 / 255),
    surface2: rgb(246 / 255, 249 / 255, 255 / 255),
    border: rgb(230 / 255, 235 / 255, 245 / 255),
    textMuted: rgb(120 / 255, 130 / 255, 150 / 255),
    text: rgb(11 / 255, 18 / 255, 32 / 255),
  };

  const headerH = 78;
  page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: brand.surface2 });
  page.drawRectangle({ x: 0, y: height - headerH, width, height: 2, color: brand.accent });

  page.drawText("MILODO medical", { x: margin, y: height - 34, size: 12, font: fontBold, color: brand.text });
  page.drawText("Personalfragebogen Honorar", {
    x: margin,
    y: height - 54,
    size: 18,
    font: fontBold,
    color: brand.text,
  });

  const metaRight = `#${questionnaire.id} • ${
    questionnaire.createdAt ? new Date(questionnaire.createdAt).toLocaleString("de-DE") : ""
  }`;
  page.drawText(metaRight, {
    x: width - margin - font.widthOfTextAtSize(metaRight, 10),
    y: height - 54,
    size: 10,
    font,
    color: brand.textMuted,
  });

  y = height - headerH - 18;

  function sectionTitle(title: string) {
    page.drawText(title, { x: margin, y, size: 12, font: fontBold, color: brand.text });
    y -= 10;
    page.drawRectangle({ x: margin, y, width: width - margin * 2, height: 1, color: brand.border });
    y -= 16;
  }

  function field(label: string, value: string) {
    const labelSize = 9;
    const valueSize = 11;
    page.drawText(label, { x: margin, y, size: labelSize, font: fontBold, color: brand.textMuted });
    y -= 13;

    const lines = wrapText({ text: value || "—", font, size: valueSize, maxWidth: width - margin * 2 });
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size: valueSize, font, color: brand.text });
      y -= 14;
    }
    y -= 6;
  }

  sectionTitle("1) Persönliche Daten");
  field("Name", `${questionnaire.firstName} ${questionnaire.lastName}`.trim());
  field("Geburtsdatum", questionnaire.geb ? new Date(questionnaire.geb).toLocaleDateString("de-DE") : "—");
  field("Steuernummer", questionnaire.taxNumber || "—");
  field(
    "Anschrift",
    [questionnaire.street, questionnaire.houseNumber, questionnaire.plz, questionnaire.city, questionnaire.cityExtra]
      .filter(Boolean)
      .join(" "),
  );
  field(
    "Telefon",
    `${questionnaire.phone || "—"}${
      questionnaire.phone ? (questionnaire.phoneShare ? " (weitergeben: ja)" : " (weitergeben: nein)") : ""
    }`,
  );
  field("E‑Mail", questionnaire.email || "—");

  sectionTitle("2) Bankverbindung");
  field(
    "Kontoinhaber",
    `${questionnaire.bankAccountHolder || "—"}${
      questionnaire.bankAccountHolderDiffers ? " (abweichend)" : " (entspricht Name)"
    }`,
  );
  field("Kreditinstitut", questionnaire.bankName || "—");
  field("IBAN", questionnaire.iban || "—");
  field("BLZ", questionnaire.blz || "—");

  sectionTitle("3) Einsatz & Qualifikation");
  field("Einsatzfeld", einsatzfelder.length ? einsatzfelder.join(", ") : "—");
  field("Medizinische Qualifikation", questionnaire.qualMed || "—");
  field("EH Ausbilder", questionnaire.qualEhAusbilder ? "ja" : "nein");

  sectionTitle("4) Kleidungsgrößen");
  field(
    "Größen",
    [
      `T‑Shirt: ${sizes.tshirt || "—"}`,
      `Jacke: ${sizes.jacket || "—"}`,
      `Hose: ${sizes.pants || "—"}`,
      `Schuhe: ${sizes.shoes || "—"}`,
      `Handschuhe: ${sizes.gloves || "—"}`,
    ].join(" • "),
  );
  field("Neutrale PSA vorhanden", questionnaire.hasNeutralPsa ? "ja" : "nein");

  sectionTitle("5) Fahrerlaubnis");
  field("Fahrerlaubnis", driverLicences.length ? driverLicences.join(", ") : "—");
  field("P‑Schein vorhanden", questionnaire.hasPss ? "ja" : "nein");
  field("Eigener PKW", questionnaire.ownCar ? "ja" : "nein");

  sectionTitle("6) Kontaktwunsch");
  field("Kontakt erwünscht per", contactPrefs.length ? contactPrefs.join(", ") : "—");

  field("Uploads (Anzahl)", String(uploadedCount));

  const bytes = await pdf.save();
  return Uint8Array.from(bytes);
}

