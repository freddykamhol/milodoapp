export class AssetValidationError extends Error {}
export const assetManager = (role: string) => role === "ADMIN" || role === "VERWALTUNG";
export function integer(value: unknown, label: string, fallback?: number): number {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new AssetValidationError(`${label} muss eine ganze Zahl ab 0 sein.`);
  return result;
}
export function assetDate(value: unknown, label: string, required = false): Date | null {
  if (value === undefined || value === null || value === "") { if (required) throw new AssetValidationError(`${label} fehlt.`); return null; }
  const result = new Date(value as string | number);
  if (!Number.isFinite(result.getTime())) throw new AssetValidationError(`${label} ist ungültig.`);
  return result;
}
export const inventoryPrefixes: Record<string, string> = { MEDICAL_DEVICE: "MED", CONSUMABLE: "VER", BAG: "TAS", OTHER: "SON" };
export function nextInventoryNumber(category: string, existing: (string | null)[]): string {
  const prefix = inventoryPrefixes[category];
  if (!prefix) throw new AssetValidationError("Ungültige Kategorie.");
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highest = existing.reduce((max, value) => { const match = String(value ?? "").match(pattern); return match ? Math.max(max, Number(match[1])) : max; }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}
