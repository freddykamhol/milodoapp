import "dotenv/config";

import { defineConfig } from "drizzle-kit";

function normalizeSqlitePath(value: string) {
  if (value.startsWith("file:")) return value.slice("file:".length);
  return value;
}

const url = normalizeSqlitePath(process.env.DATABASE_URL ?? "./dev.db");

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
});

