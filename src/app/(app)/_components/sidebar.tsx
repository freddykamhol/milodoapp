"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { IconChevronRight } from "./icons";
import { TodayInView } from "./today-in-view";

type ViewerRole = "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";

function navItemsFor(role: ViewerRole | null) {
  if (role === "KUNDE") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Termin erstellen", href: "/appointments/new" },
      { label: "Dokumente", href: "/documents/services" },
      { label: "Einstellungen", href: "/settings" },
    ] as const;
  }

  if (role === "PERSONAL") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Kalender", href: "/calendar" },
      { label: "Termine / Dienste", href: "/appointments" },
      { label: "Mitglieder", href: "/members" },
      { label: "Dokumente", href: "/documents" },
      { label: "Stunden", href: "/hours" },
      { label: "Einstellungen", href: "/settings" },
    ] as const;
  }

  return [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Kalender", href: "/calendar" },
    { label: "Termine / Dienste", href: "/appointments" },
    { label: "Kunden", href: "/customers" },
    { label: "Anforderungen", href: "/requirements" },
    { label: "Kontaktanfragen", href: "/contactanfragen" },
    { label: "Personalfragebögen", href: "/personalfrageboegen" },
    { label: "Blog", href: "/blog" },
    { label: "Mitglieder", href: "/members" },
    { label: "Dokumente", href: "/documents" },
    { label: "Stunden", href: "/hours" },
    { label: "Einstellungen", href: "/settings" },
  ] as const;
}

export function Sidebar({ role }: { role: ViewerRole | null }) {
  const pathname = usePathname();

  const navItems = navItemsFor(role);
  const showTodayInView = role !== null && role !== "KUNDE";

  return (
    <aside className="hidden md:block">
      <div className="sticky top-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3 px-2 py-2">
          <Link href="/dashboard" className="inline-flex items-center">
            <Image
              src="/logo/MILODO.png"
              alt="MILODO"
              width={1305}
              height={350}
              className="h-[35px] w-auto"
              priority
            />
          </Link>
        </div>

        <nav className="mt-4 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold tracking-tight",
                  isActive
                    ? "bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] text-[color:var(--foreground)]"
                    : "text-[color:var(--muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--foreground)]",
                ].join(" ")}
              >
                <span className="truncate">{item.label}</span>
                <IconChevronRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </Link>
            );
          })}
        </nav>

        {showTodayInView ? <TodayInView /> : null}
      </div>
    </aside>
  );
}
