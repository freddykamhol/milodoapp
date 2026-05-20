function normalizeUrl(value: string) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

export function getAppUrl(options?: { fallbackOrigin?: string | null }) {
  const envUrl = normalizeUrl(process.env.APP_URL || "");
  if (envUrl) return envUrl;

  const fallbackOrigin = normalizeUrl(options?.fallbackOrigin || "");
  if (fallbackOrigin) return fallbackOrigin;

  if (process.env.NODE_ENV === "production") return "https://portal.milodo-medical.de";
  return "http://localhost:3000";
}

