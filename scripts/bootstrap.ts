import "dotenv/config";

import { spawnSync } from "node:child_process";

import { runMigrations } from "./migrate";
import { resetDbFile } from "./reset-db";

async function main() {
  try {
    await runMigrations();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldReset =
      message.includes("migration history does not match") ||
      message.includes("duplicate column name") ||
      message.includes("already exists");

    if (shouldReset) {
      console.warn(message);
      console.warn("Resetting DB file and retrying migrations...");
      resetDbFile();
      await runMigrations();
    } else {
      throw error;
    }
  }

  const res = spawnSync("npm", ["run", "db:seed"], { stdio: "inherit", env: process.env });
  process.exit(res.status ?? 1);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
