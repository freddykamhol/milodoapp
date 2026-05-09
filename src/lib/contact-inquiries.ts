import { sqlite } from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var __milodo_contact_inquiries_ready: boolean | undefined;
}

type ColumnDef = { name: string; sql: string };

function existingColumns(table: string): Set<string> {
  const rows = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name?: unknown }>;
  return new Set(rows.map((r) => String(r.name ?? "")).filter(Boolean));
}

function addMissingColumns(table: string, columns: ColumnDef[]) {
  const existing = existingColumns(table);
  for (const col of columns) {
    if (existing.has(col.name)) continue;
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col.sql};`);
  }
}

export function ensureContactInquiriesTable() {
  if (globalThis.__milodo_contact_inquiries_ready) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
      updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
      status TEXT NOT NULL DEFAULT 'NEW',
      source TEXT NOT NULL DEFAULT 'website',
      source_url TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT 'kontakt',
      name TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      privacy_consent INTEGER NOT NULL DEFAULT 0,
      privacy_consent_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS contact_inquiries_created_at_idx ON contact_inquiries(created_at);
    CREATE INDEX IF NOT EXISTS contact_inquiries_status_idx ON contact_inquiries(status);
    CREATE INDEX IF NOT EXISTS contact_inquiries_email_idx ON contact_inquiries(email);
  `);

  addMissingColumns("contact_inquiries", [
    { name: "read_at", sql: "read_at INTEGER" },
    { name: "deleted_at", sql: "deleted_at INTEGER" },
    { name: "ip", sql: "ip TEXT NOT NULL DEFAULT ''" },
    { name: "user_agent", sql: "user_agent TEXT NOT NULL DEFAULT ''" },
    // store score * 1000 as integer (0-1000) to avoid float surprises
    { name: "recaptcha_score_bp", sql: "recaptcha_score_bp INTEGER" },
    { name: "recaptcha_action", sql: "recaptcha_action TEXT NOT NULL DEFAULT ''" },
  ]);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS contact_inquiries_read_at_idx ON contact_inquiries(read_at);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS contact_inquiries_deleted_at_idx ON contact_inquiries(deleted_at);`);

  globalThis.__milodo_contact_inquiries_ready = true;
}
