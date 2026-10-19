import { spawn } from "node:child_process";
import { createRequire } from "node:module";

process.env.NODE_ENV = "development";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const nextProcess = spawn(process.execPath, [nextBin, "dev", "--webpack", "-H", "localhost"], {
  env: process.env,
  stdio: "inherit",
});

nextProcess.on("error", (error) => {
  console.error("Failed to start Next.js:", error);
  process.exitCode = 1;
});

nextProcess.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
