import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/db/schema";

declare global {
  var sqlite: Database.Database | undefined;
}

function normalizeSqlitePath(value: string) {
  if (value.startsWith("file:")) return value.slice("file:".length);
  return value;
}

const sqlitePath = normalizeSqlitePath(process.env.DATABASE_URL ?? "./dev.db");

export const sqlite = globalThis.sqlite ?? new Database(sqlitePath);

sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("cache_size = -32000");
sqlite.pragma("temp_store = MEMORY");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") globalThis.sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
