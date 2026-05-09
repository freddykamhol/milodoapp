"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ViewerRole = "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";

const baseTabs = [{ label: "Benachrichtigungen", href: "/settings/notifications" }] as const;
const staffOnlyTabs = [
  { label: "Gebühren", href: "/settings/fees" },
  { label: "Integrationen", href: "/settings/integrations" },
  { label: "Statistiken", href: "/settings/stats" },
] as const;

export function SettingsTabs({ viewerRole }: { viewerRole: ViewerRole | null }) {
  const pathname = usePathname();
  const tabs =
    viewerRole === null
      ? baseTabs
      : viewerRole === "ADMIN" || viewerRole === "VERWALTUNG"
        ? [...baseTabs, ...staffOnlyTabs]
        : viewerRole === "PERSONAL"
          ? [...baseTabs, ...staffOnlyTabs]
        : baseTabs;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)]">
      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const isActive = pathname === t.href || (t.href === "/settings/notifications" && pathname === "/settings");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                "rounded-2xl px-3 py-2 text-sm font-semibold tracking-tight",
                isActive
                  ? "bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] text-[color:var(--foreground)]"
                  : "text-[color:var(--muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
