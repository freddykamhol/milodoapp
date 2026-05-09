CREATE TABLE IF NOT EXISTS "sftp_settings" (
  "id" integer PRIMARY KEY NOT NULL,
  "created_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
  "enabled" integer NOT NULL DEFAULT 0,
  "host" text NOT NULL DEFAULT '',
  "port" integer NOT NULL DEFAULT 22,
  "username" text NOT NULL DEFAULT '',
  "password" text NOT NULL DEFAULT '',
  "remote_path" text NOT NULL DEFAULT '/'
);

