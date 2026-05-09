"use client";

import * as React from "react";
import Link from "next/link";

import { Card } from "../(app)/_components/ui";

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!email.trim()) return window.alert("E-Mail fehlt.");
    setBusy(true);
    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      window.alert("Wenn die E-Mail existiert, wurde ein Reset-Link versendet.");
      setEmail("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Card
        title="Passwort vergessen"
        description="Gib deine E-Mail an. Du bekommst einen Link, um ein neues Passwort zu setzen."
        actions={
          <Link href="/" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
            Zur Startseite
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">E-Mail</span>
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
            >
              {busy ? "Sende…" : "Link anfordern"}
            </button>
          </div>
        </div>
      </Card>
    </main>
  );
}
