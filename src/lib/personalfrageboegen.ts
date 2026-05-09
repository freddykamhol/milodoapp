import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export async function ensurePersonalfrageboegenSchema() {
  // This project currently has a flaky drizzle migration runner (TTY/hanging issues).
  // To keep the app functional, we lazily ensure required columns/indexes exist at runtime.
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN created_user_id integer;`);
  } catch {
    // ignore (already exists or table missing)
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN created_username text NOT NULL DEFAULT '';`);
  } catch {
    // ignore
  }
  try {
    await db.run(sql`ALTER TABLE personal_questionnaires ADD COLUMN created_user_at integer;`);
  } catch {
    // ignore
  }
  try {
    await db.run(
      sql`CREATE INDEX IF NOT EXISTS personal_questionnaires_created_user_id_idx ON personal_questionnaires (created_user_id);`,
    );
  } catch {
    // ignore
  }
}

