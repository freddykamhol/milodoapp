"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

export function ResetPasswordClient({ token }: { token: string }) {
  const router = useRouter();
  const [pw1, setPw1] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!token) return window.alert("Token fehlt.");
    if (pw1.length < 8) return window.alert("Passwort muss mindestens 8 Zeichen haben.");
    if (pw1 !== pw2) return window.alert("Passwörter stimmen nicht überein.");

    setBusy(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw1 }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "reset_failed");

      window.alert("Passwort gesetzt.");
      router.push("/");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reset fehlgeschlagen.";
      window.alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Neues Passwort</span>
        <input type="password" className={inputClass} value={pw1} onChange={(e) => setPw1(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Neues Passwort (wiederholen)</span>
        <input type="password" className={inputClass} value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </label>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          {busy ? "Speichere…" : "Passwort setzen"}
        </button>
      </div>
    </div>
  );
}

