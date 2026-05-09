import type * as React from "react";

import { IconSearch } from "./icons";
import { MobileNav } from "./mobile-nav";
import { NotificationsMenu } from "./notifications-menu";
import { PageTransition } from "./page-transition";
import { SessionGuard } from "./session-guard";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export function AppShell({
  eyebrow = "Willkommen zurück",
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // server component: viewer role is available at render time, preventing nav flicker
  const viewerPromise = getViewer();

  return (
    <div className="min-h-dvh px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
        <SidebarWithViewer viewerPromise={viewerPromise} />

        <div className="flex min-h-dvh flex-col gap-6">
          <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)] sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">
                  {eyebrow}
                </p>
                <h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 hidden text-sm text-[color:var(--muted)] sm:block">
                    {subtitle}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <MobileNavWithViewer viewerPromise={viewerPromise} />
                <label className="relative hidden sm:block">
                  <span className="sr-only">Suchen</span>
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                  <input
                    className="h-10 w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] pl-9 pr-3 text-sm outline-none ring-0 placeholder:text-[color:var(--muted)] focus:border-[color:var(--ring)] focus:bg-[var(--surface)]"
                    placeholder="Termine, Datum, Mitglieder…"
                  />
                </label>

                <NotificationsMenu />

                <UserMenuWithViewer viewerPromise={viewerPromise} />
              </div>
            </div>
          </header>

          <main className="flex flex-col">
            <SessionGuard />
            <PageTransition>{children}</PageTransition>
          </main>

          <footer className="flex items-center justify-between gap-3 px-1 pb-4 text-xs text-[color:var(--muted)]">
            <p>milodo medical • App</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

type ViewerRole = "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
type Viewer = Awaited<ReturnType<typeof getViewer>>;

async function SidebarWithViewer({ viewerPromise }: { viewerPromise: Promise<Viewer> }) {
  const viewer = await viewerPromise;
  return <Sidebar role={viewer?.role ?? null} />;
}

async function MobileNavWithViewer({ viewerPromise }: { viewerPromise: Promise<Viewer> }) {
  const viewer = await viewerPromise;
  return <MobileNav role={viewer?.role ?? null} />;
}

function roleLabel(role: ViewerRole) {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "VERWALTUNG":
      return "Verwaltung";
    case "PERSONAL":
      return "Personal";
    case "KUNDE":
      return "Kunde";
  }
}

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");
  const fallback = name.trim().slice(0, 2);
  return (letters || fallback || "?").toUpperCase();
}

async function UserMenuWithViewer({ viewerPromise }: { viewerPromise: Promise<Viewer> }) {
  const viewer = await viewerPromise;

  if (!viewer) return <UserMenu displayName="Profil" roleLabel="" initials="?" />;

  const displayNameBase = viewer.role === "KUNDE" ? await customerDisplayName(viewer.id) : null;
  const displayName = (displayNameBase ?? viewer.firstName ?? "").trim() || viewer.username;

  return (
    <UserMenu
      displayName={displayName}
      roleLabel={roleLabel(viewer.role)}
      initials={initialsFromName(displayName)}
    />
  );
}

async function customerDisplayName(userId: number) {
  const customer =
    (await db.query.customers.findFirst({ where: (t, { eq }) => eq(t.accountUserId, userId) })) ??
    null;
  return customer?.name ?? null;
}
