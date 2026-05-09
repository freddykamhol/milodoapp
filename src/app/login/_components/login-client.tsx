"use client";

import * as React from "react";

export function LoginClient() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void (async () => {
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ username, password }),
            });
            const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !json?.ok) {
              setError(json?.error ?? "login_failed");
              setBusy(false);
              return;
            }
            try {
              window.localStorage.removeItem("milodo:logged-out:v1");
            } catch {
              // ignore
            }
            window.location.href = "/dashboard";
          } catch {
            setError("network_error");
            setBusy(false);
          }
        })();
      }}
    >
      <label className="block">
        <span className="text-xs font-semibold text-[color:color-mix(in_oklab,var(--foreground)_56%,transparent)]">
          Username
        </span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="mt-1 h-11 w-full rounded-2xl border border-[color:color-mix(in_oklab,var(--foreground)_18%,transparent)] bg-white px-4 text-sm font-medium outline-none focus:border-[color:var(--ring)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[color:color-mix(in_oklab,var(--foreground)_56%,transparent)]">
          Passwort
        </span>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          className="mt-1 h-11 w-full rounded-2xl border border-[color:color-mix(in_oklab,var(--foreground)_18%,transparent)] bg-white px-4 text-sm font-medium outline-none focus:border-[color:var(--ring)]"
        />
      </label>

      {error ? (
        <p className="rounded-2xl bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]">
          {error === "auth_secret_missing"
            ? "Server-Konfiguration fehlt: AUTH_SECRET ist nicht gesetzt."
            : "Login fehlgeschlagen."}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !username.trim() || !password}
        className="h-11 w-full rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
      >
        {busy ? "Anmelden…" : "Anmelden"}
      </button>
    </form>
  );
}
