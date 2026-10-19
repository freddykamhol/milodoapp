import type { Metadata } from "next";
import { FeedbackHost } from "./_components/feedback";

export const metadata: Metadata = {
  title: "milodo-medical",
  description: "Dashboard im milodo-medical Design (Next.js + TypeScript + Tailwind CSS).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>{children}<FeedbackHost /></body>
    </html>
  );
}
