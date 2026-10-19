import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  serverExternalPackages: ["ssh2-sftp-client", "ssh2", "nodemailer", "better-sqlite3"],
};

export default nextConfig;
