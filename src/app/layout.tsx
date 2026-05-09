import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "milodo-medical",
  description: "Dashboard im milodo-medical Design (Next.js + TypeScript + Tailwind CSS).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
