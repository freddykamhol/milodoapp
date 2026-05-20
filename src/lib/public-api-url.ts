function normalizeUrl(value: string) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

export function getPublicApiUrl() {
  const url = normalizeUrl(process.env.PUBLIC_API_URL || "");
  return url || null;
}

