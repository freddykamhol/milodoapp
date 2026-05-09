import { SignedOutClient } from "./signed-out-client";

export default function SignedOutPage() {
  return (
    <main className="min-h-dvh px-6 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-[color:color-mix(in_oklab,var(--foreground)_14%,transparent)] bg-white p-6 shadow-[0_18px_50px_rgba(11,18,32,0.12)]">
        <p className="text-xs font-semibold tracking-wide text-[color:color-mix(in_oklab,var(--foreground)_56%,transparent)]">
          Session beendet
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Du wurdest ausgeloggt</h1>
        <p className="mt-2 text-sm text-[color:color-mix(in_oklab,var(--foreground)_56%,transparent)]">
          Aus Sicherheitsgründen erfolgt nach 30 Minuten automatisch ein Logout.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <SignedOutClient />
          <p className="text-center text-xs text-[color:color-mix(in_oklab,var(--foreground)_56%,transparent)]">
            Tipp: Jede Aktivität setzt den Timer zurück.
          </p>
        </div>
      </div>
    </main>
  );
}
