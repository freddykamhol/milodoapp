import Image from "next/image";
import Link from "next/link";

import { PersonalfragebogenHonorarClient } from "./personalfragebogen-honorar-client";

export default function PersonalfragebogenHonorarPage() {
  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-2 shadow-[var(--shadow-soft)]">
              <Image src="/logo/MILODO.png" alt="MILODO" width={1305} height={350} className="h-7 w-auto" priority />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">MILODO medical</p>
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                Personalfragebogen Honorar
              </h1>
            </div>
          </div>
          <div className="hidden sm:block">
            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] shadow-[var(--shadow-soft)]">
              ~ 5–10 Minuten
            </span>
          </div>
        </header>

        <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow)] sm:p-6">
          <p className="text-sm text-[color:var(--muted)]">
            Bitte fülle alle Seiten aus und lade die passenden Nachweise hoch. Am Ende kannst du alles absenden.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/personalfragebogen-honorar"
              className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)]"
            >
              Honorar
            </Link>
            <Link
              href="/personalfragebogen-minijob"
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
            >
              GfB / Minijob
            </Link>
          </div>
          <div className="mt-6">
            <PersonalfragebogenHonorarClient />
          </div>
        </div>
      </div>
    </main>
  );
}
