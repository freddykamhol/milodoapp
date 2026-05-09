"use client";

import Link from "next/link";

export function SignedOutClient() {
  return (
    <Link
      href="/login"
      onClick={() => {
        try {
          window.localStorage.removeItem("milodo:logged-out:v1");
        } catch {
          // ignore
        }
      }}
      className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
    >
      Weiter als Demo
    </Link>
  );
}
