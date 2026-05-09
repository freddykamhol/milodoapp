import { sqlite } from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var __milodo_contact_ip_blocklist_ready: boolean | undefined;
}

export function ensureContactIpBlocklistTable() {
  if (globalThis.__milodo_contact_ip_blocklist_ready) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS contact_ip_blocklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
      updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
      enabled INTEGER NOT NULL DEFAULT 1,
      ip TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS contact_ip_blocklist_ip_unique ON contact_ip_blocklist(ip);
    CREATE INDEX IF NOT EXISTS contact_ip_blocklist_enabled_idx ON contact_ip_blocklist(enabled);
  `);

  globalThis.__milodo_contact_ip_blocklist_ready = true;
}

export function isIpBlocked(ip: string): boolean {
  const clean = String(ip ?? "").trim();
  if (!clean) return false;
  ensureContactIpBlocklistTable();
  const row = sqlite
    .prepare("SELECT enabled FROM contact_ip_blocklist WHERE ip = ? LIMIT 1")
    .get(clean) as { enabled?: unknown } | undefined;
  return row ? Boolean(row.enabled) : false;
}

export function blockIp(ip: string, reason?: string) {
  const clean = String(ip ?? "").trim();
  if (!clean) return;
  ensureContactIpBlocklistTable();
  const now = Date.now();
  sqlite
    .prepare(
      `INSERT INTO contact_ip_blocklist (created_at, updated_at, enabled, ip, reason)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at, reason = excluded.reason`,
    )
    .run(now, now, clean, String(reason ?? "").trim());
}
