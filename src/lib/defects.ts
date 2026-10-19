export const defectStatuses = ["ERSTELLT", "IN_BEARBEITUNG", "BEHOBEN"] as const;
export type DefectStatus = (typeof defectStatuses)[number];
export const defectStatusLabels: Record<string, string> = { ERSTELLT: "Erstellt", IN_BEARBEITUNG: "In Bearbeitung", BEHOBEN: "Behoben" };
export const vehicleDefectCategories: Record<string, string> = { ELEKTRIK: "Elektrik", AUFBAU: "Aufbau", FAHRGESTELL: "Fahrgestell", MOTOR_GETRIEBE: "Motor / Getriebe" };
export const defectTone = (status: string) => status === "BEHOBEN" ? "success" as const : status === "IN_BEARBEITUNG" ? "warning" as const : "accent" as const;
export function defectImages(value: unknown): string[] {
  let images = value;
  if (typeof images === "string") { try { images = JSON.parse(images); } catch { return []; } }
  return Array.isArray(images) ? images.filter((image): image is string => typeof image === "string" && (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(image) || /^https?:\/\//i.test(image) || /^\/(?!\/)/.test(image))).slice(0, 5) : [];
}
