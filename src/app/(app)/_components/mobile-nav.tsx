"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

import { IconChevronRight, IconMenu } from "./icons";

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
    { label: "Mitglieder", href: "/members" },
    { label: "Dokumente", href: "/documents" },
    { label: "Stunden", href: "/hours" },
    { label: "Einstellungen", href: "/settings" },
  ] as const;
}

export function MobileNav({ role }: { role: ViewerRole | null }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const navItems = navItemsFor(role);

  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.06)] transition hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)] md:hidden"
        aria-label="Menü"
      >
        <IconMenu className="h-4 w-4" />
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
                  <p className="text-sm font-semibold">Menü</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                  >
                    Schließen
                  </button>
                </div>

                <nav className="flex flex-col p-2">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={[
                          "group flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold tracking-tight",
                          isActive
                            ? "bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] text-[color:var(--foreground)]"
                            : "text-[color:var(--muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--foreground)]",
                        ].join(" ")}
                      >
                        <span className="truncate">{item.label}</span>
                        <IconChevronRight className="h-4 w-4 opacity-60" />
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
