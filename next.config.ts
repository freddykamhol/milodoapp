import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["ssh2-sftp-client", "ssh2", "nodemailer"],
};

export default nextConfig;
