import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

function normalizeSqlitePath(value: string) {
  if (value.startsWith("file:")) return value.slice("file:".length);
  return value;
}

function timestampForFilename(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function resetDbFile() {
  const rawUrl = process.env.DATABASE_URL ?? "./dev.db";
  const sqlitePath = normalizeSqlitePath(rawUrl);

  if (sqlitePath === ":memory:") {
    console.log("DATABASE_URL is ':memory:'; nothing to reset");
    return;
  }

  const isAbsolute = path.isAbsolute(sqlitePath);
  const allowAbsolute = process.env.DB_RESET_ALLOW_ABSOLUTE === "1";
  if (isAbsolute && !allowAbsolute) {
    throw new Error(
      `Refusing to reset absolute DATABASE_URL=${rawUrl}. Set DB_RESET_ALLOW_ABSOLUTE=1 if you really want this.`,
    );
  }

  if (!fs.existsSync(sqlitePath)) {
    console.log(`No DB file at ${sqlitePath}; nothing to reset`);
    return;
  }

  const backupPath = `${sqlitePath}.bak-${timestampForFilename()}`;
  fs.renameSync(sqlitePath, backupPath);
  console.log(`Moved ${sqlitePath} -> ${backupPath}`);
}

if (require.main === module) {
  try {
    resetDbFile();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

