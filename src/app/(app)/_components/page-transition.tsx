"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-transition flex flex-col gap-6">
      {children}
    </div>
  );
}
