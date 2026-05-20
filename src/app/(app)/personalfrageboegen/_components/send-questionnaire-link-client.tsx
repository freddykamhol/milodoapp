"use client";

import * as React from "react";
import { createPortal } from "react-dom";

export function SendQuestionnaireLinkClient() {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"HONORAR" | "MINIJOB">("HONORAR");
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSent(false);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[var(--shadow-soft)] hover:brightness-[1.02]"
      >
        Link versenden
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-label="Personalfragebogen-Link versenden"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Personalfragebogen-Link versenden</p>
                    <p className="mt-1 text-xs text-[color:var(--muted)]">Sendet einen Link zum öffentlichen Formular.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)]"
                  >
                    Schließen
                  </button>
                </div>

                <div className="px-5 py-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Fragebogen</span>
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value === "MINIJOB" ? "MINIJOB" : "HONORAR")}
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="HONORAR">Honorar</option>
                        <option value="MINIJOB">Minijob</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Ziel‑E‑Mail</span>
                      <input
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="ziel@email.de"
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none"
                      />
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Betreff (optional)</span>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="wird automatisch gesetzt"
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none"
                    />
                  </label>

                  <label className="mt-4 block">
                    <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Netter Text (optional)</span>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={7}
                      placeholder="z.B. kurzer Hinweis + Bitte ausfüllen…"
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none"
                    />
                    <p className="mt-1 text-[11px] text-[color:var(--muted)]">Der Link wird automatisch am Ende angehängt.</p>
                  </label>

                  {error ? <p className="mt-3 text-xs text-[color:var(--danger)]">Fehler: {error}</p> : null}
                  {sent ? <p className="mt-3 text-xs font-semibold text-[color:var(--success)]">E‑Mail wurde gesendet.</p> : null}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                      disabled={busy}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        setSent(false);
                        setBusy(true);
                        try {
                          const res = await fetch("/api/personalfrageboegen/send-link", {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ to, kind, subject, message }),
                          });
                          const json = (await res.json()) as { ok: boolean; error?: string; message?: string };
                          if (!res.ok || !json.ok) throw new Error(json.message || json.error || "send_failed");
                          setSent(true);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "send_failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy || !to.trim()}
                      className={[
                        "inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)]",
                        busy || !to.trim() ? "opacity-60" : "hover:brightness-[1.02]",
                      ].join(" ")}
                    >
                      {busy ? "Sende…" : "Link senden"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

