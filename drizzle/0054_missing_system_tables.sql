CREATE TABLE IF NOT EXISTS contact_inquiries (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 read_at INTEGER,
 deleted_at INTEGER,
 status TEXT NOT NULL DEFAULT 'NEW',
 source TEXT NOT NULL DEFAULT 'website',
 source_url TEXT NOT NULL DEFAULT '',
 ip TEXT NOT NULL DEFAULT '',
 user_agent TEXT NOT NULL DEFAULT '',
 recaptcha_score_bp INTEGER,
 recaptcha_action TEXT NOT NULL DEFAULT '',
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
CREATE INDEX IF NOT EXISTS contact_inquiries_read_at_idx ON contact_inquiries(read_at);
CREATE INDEX IF NOT EXISTS contact_inquiries_deleted_at_idx ON contact_inquiries(deleted_at);
CREATE INDEX IF NOT EXISTS contact_inquiries_status_idx ON contact_inquiries(status);
CREATE INDEX IF NOT EXISTS contact_inquiries_email_idx ON contact_inquiries(email);
CREATE TABLE IF NOT EXISTS requirement_presets (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS requirement_presets_name_unique ON requirement_presets(name);
CREATE TABLE IF NOT EXISTS requirement_preset_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 preset_id INTEGER NOT NULL REFERENCES requirement_presets(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,
 value TEXT NOT NULL,
 min_count INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS requirement_preset_items_preset_id_idx ON requirement_preset_items(preset_id);
CREATE INDEX IF NOT EXISTS requirement_preset_items_kind_value_idx ON requirement_preset_items(kind,value);
