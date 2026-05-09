import { sqlite } from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var __milodo_contact_inquiries_ready: boolean | undefined;
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

  globalThis.__milodo_contact_inquiries_ready = true;
}

