CREATE TABLE IF NOT EXISTS "appointment_files" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "created_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
  "appointment_id" integer NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL DEFAULT 'application/pdf',
  "size_bytes" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "appointment_files_appointment_id_idx" ON "appointment_files" ("appointment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_files_storage_key_unique" ON "appointment_files" ("storage_key");

