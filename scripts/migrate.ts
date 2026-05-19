import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

function normalizeSqlitePath(value: string) {
  if (value.startsWith("file:")) return value.slice("file:".length);
  return value;
}

function openSqlite() {
  const url = normalizeSqlitePath(process.env.DATABASE_URL ?? "./dev.db");
  return new Database(url);
}

function ensureValidMigrationsTable() {
  const sqlite = openSqlite();
  try {
    const table =
      (sqlite
        .prepare("select name from sqlite_master where type='table' and name='__drizzle_migrations'")
        .get() as { name: string } | undefined) ?? null;

    if (!table) return;

    const columns = sqlite.prepare("pragma table_info('__drizzle_migrations')").all() as Array<{
      name: string;
      type: string;
    }>;

    const idColumn = columns.find((col) => col.name === "id") ?? null;
    if (!idColumn) return;

    const idType = (idColumn.type ?? "").toUpperCase();

    // Drizzle Kit can create the sqlite migrations table with `id SERIAL PRIMARY KEY`,
    // which in SQLite does *not* behave like an auto-incrementing rowid alias.
    if (idType === "INTEGER") return;

    sqlite.exec("begin");
    try {
      sqlite.exec(`create table "__drizzle_migrations_new" (
        id integer primary key autoincrement,
        hash text not null,
        created_at numeric
      )`);

      const rows = sqlite
        .prepare("select hash, created_at from __drizzle_migrations order by created_at asc, rowid asc")
        .all() as Array<{ hash: string; created_at: number | string | null }>;

      const insert = sqlite.prepare(
        "insert into __drizzle_migrations_new (id, hash, created_at) values (?, ?, ?)",
      );

      for (let idx = 0; idx < rows.length; idx += 1) {
        const row = rows[idx];
        insert.run(idx + 1, row.hash, row.created_at);
      }

      sqlite.exec('drop table "__drizzle_migrations"');
      sqlite.exec('alter table "__drizzle_migrations_new" rename to "__drizzle_migrations"');
      sqlite.exec("commit");
    } catch (error) {
      sqlite.exec("rollback");
      throw error;
    }
  } finally {
    sqlite.close();
  }
}

export async function runMigrations() {
  ensureValidMigrationsTable();

  const sqlite = openSqlite();
  try {
    sqlite.exec(`create table if not exists "__drizzle_migrations" (
      id integer primary key autoincrement,
      hash text not null,
      created_at numeric
    )`);

    const existingHashes = new Set(
      (
        sqlite
          .prepare("select hash from __drizzle_migrations order by created_at asc, rowid asc")
          .all() as Array<{
          hash: string;
        }>
      ).map((row) => row.hash),
    );

    const dbHashes = Array.from(existingHashes);

    const migrationsDir = path.join(process.cwd(), "drizzle");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    const insert = sqlite.prepare("insert into __drizzle_migrations (hash, created_at) values (?, ?)");

    let applied = 0;

    const fileHashes = new Set<string>();

    for (const filename of files) {
      const fullPath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(fullPath);
      const hash = crypto.createHash("sha256").update(sql).digest("hex");
      fileHashes.add(hash);
    }

    const unknownHashes = dbHashes.filter((hash) => !fileHashes.has(hash));
    if (unknownHashes.length) {
      const detail =
        unknownHashes.length > 3 ? `${unknownHashes.slice(0, 3).join(", ")}…` : unknownHashes.join(", ");
      throw new Error(
        `Database migration history does not match the current migration files (found ${unknownHashes.length} unknown hash(es): ${detail}). ` +
          `This usually means migration files were edited after being applied. Reset the DB and re-run migrations (try: npm run db:reset).`,
      );
    }

    for (const filename of files) {
      const fullPath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(fullPath);
      const hash = crypto.createHash("sha256").update(sql).digest("hex");

      if (existingHashes.has(hash)) continue;

      sqlite.exec("begin");
      try {
        sqlite.exec(sql.toString("utf8"));
        insert.run(hash, Date.now());
        sqlite.exec("commit");
        existingHashes.add(hash);
        applied += 1;
      } catch (error) {
        sqlite.exec("rollback");
        throw error;
      }
    }

    console.log(applied ? `Applied ${applied} migrations` : "No migrations to apply");
  } finally {
    sqlite.close();
  }
}

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
