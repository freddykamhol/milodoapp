import path from "node:path";

function normalizeFsPath(p: string) {
  return String(p || "").trim().replace(/\/+$/g, "");
}

export function getDataDir() {
  const envDir = normalizeFsPath(process.env.DATA_DIR || "");
  if (envDir) return envDir;
  return path.join(process.cwd(), "data");
}

