"use client";

import * as React from "react";
import { createPortal } from "react-dom";

export function QuestionnaireActionsClient({
  questionnaireId,
  pdfHref,
  existingUsername,
  existingUserId,
}: {
  questionnaireId: number;
  pdfHref: string;
  existingUsername: string | null;
  existingUserId: number | null;
}) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ id: number; username: string; emailSent: boolean } | null>(
    existingUserId && existingUsername ? { id: existingUserId, username: existingUsername, emailSent: false } : null,
  );

  const [emailOpen, setEmailOpen] = React.useState(false);
  const [emailSubject, setEmailSubject] = React.useState("MILODO – Nachricht");
  const [emailMessage, setEmailMessage] = React.useState("");
  const [emailBusy, setEmailBusy] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [emailSent, setEmailSent] = React.useState(false);

  const updatePosition = React.useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 240;
    const viewportW = window.innerWidth;
    const left = Math.min(Math.max(12, rect.right - menuWidth), viewportW - menuWidth - 12);
    const top = rect.bottom + 10;
    setPos({ top, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    function onPointerDown(event: MouseEvent) {
      const btn = buttonRef.current;
      const menu = menuRef.current;
      if (event.target instanceof Node && (btn?.contains(event.target) || menu?.contains(event.target))) return;
      setOpen(false);
    }
    function onResize() {
      updatePosition();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, updatePosition]);

  async function createUser() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/personalfrageboegen/${questionnaireId}/create-user`, { method: "POST" });
      const json = (await res.json()) as
        | { ok: true; id: number; username: string; emailSent: boolean }
        | { ok: false; error: string; username?: string };
      if (!res.ok || !json.ok) throw new Error((json as any).error || "create_failed");
      setCreated({ id: (json as any).id, username: (json as any).username, emailSent: Boolean((json as any).emailSent) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Aktionen</p>
        {created ? (
          <p className="mt-1 truncate text-sm font-semibold tracking-tight">
            Benutzer erstellt: {created.username} (ID {created.id})
          </p>
        ) : (
          <p className="mt-1 truncate text-sm font-semibold tracking-tight">Download, Benutzererstellung oder E‑Mail.</p>
        )}
        {created ? (
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Willkommens-E-Mail: {created.emailSent ? "gesendet" : "nicht gesendet"}
          </p>
        ) : null}
        {error ? <p className="mt-1 text-xs text-[color:var(--danger)]">Fehler: {error}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {created ? (
          <a
            href={`/members/${created.id}`}
            className="inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:brightness-[1.02]"
          >
            Zum Benutzer
          </a>
        ) : null}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (!open) updatePosition();
            setOpen((v) => !v);
          }}
          className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] hover:bg-[var(--surface-2)]"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          Optionen
        </button>
      </div>

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[80] w-60 overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[var(--shadow)]"
              style={{ top: pos.top, left: pos.left }}
            >
              <a
                role="menuitem"
                href={pdfHref}
                className="block px-4 py-3 text-sm font-semibold hover:bg-[var(--surface-2)]"
                onClick={() => setOpen(false)}
              >
                PDF herunterladen
              </a>
              <button
                role="menuitem"
                type="button"
                disabled={Boolean(created) || busy}
                onClick={() => {
                  setOpen(false);
                  void createUser();
                }}
                className={[
                  "block w-full px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--surface-2)]",
                  created ? "opacity-50" : "",
                ].join(" ")}
              >
                {busy ? "Benutzer wird erstellt…" : created ? "Benutzer bereits erstellt" : "Benutzer erstellen"}
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  setEmailOpen(true);
                  setEmailSent(false);
                  setEmailError(null);
                }}
                className="block w-full px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--surface-2)]"
              >
                E‑Mail schreiben
              </button>
            </div>,
            document.body,
          )
        : null}

      {emailOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-label="E‑Mail schreiben"
              onClick={(e) => {
                if (e.target === e.currentTarget) setEmailOpen(false);
              }}
            >
              <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">E‑Mail schreiben</p>
                    <p className="mt-1 text-xs text-[color:var(--muted)]">Wird an die im Fragebogen hinterlegte Adresse gesendet.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailOpen(false)}
                    className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)]"
                  >
                    Schließen
                  </button>
                </div>
                <div className="px-5 py-4">
                  <label className="block">
                    <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Betreff</span>
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border))] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]"
                    />
                  </label>
                  <label className="mt-4 block">
                    <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">Nachricht</span>
                    <textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={8}
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border))] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]"
                      placeholder="Text eingeben…"
                    />
                  </label>

                  {emailError ? <p className="mt-3 text-xs text-[color:var(--danger)]">Fehler: {emailError}</p> : null}
                  {emailSent ? (
                    <p className="mt-3 text-xs font-semibold text-[color:var(--success)]">E‑Mail wurde gesendet.</p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEmailOpen(false)}
                      className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                      disabled={emailBusy}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setEmailError(null);
                        setEmailSent(false);
                        setEmailBusy(true);
                        try {
                          const res = await fetch(`/api/personalfrageboegen/${questionnaireId}/email`, {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ subject: emailSubject, message: emailMessage }),
                          });
                          const json = (await res.json()) as { ok: boolean; error?: string; message?: string };
                          if (!res.ok || !json.ok) throw new Error(json.message || json.error || "send_failed");
                          setEmailSent(true);
                        } catch (e) {
                          setEmailError(e instanceof Error ? e.message : "send_failed");
                        } finally {
                          setEmailBusy(false);
                        }
                      }}
                      disabled={emailBusy || !emailMessage.trim()}
                      className={[
                        "inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)]",
                        emailBusy || !emailMessage.trim() ? "opacity-60" : "hover:brightness-[1.02]",
                      ].join(" ")}
                    >
                      {emailBusy ? "Sende…" : "E‑Mail senden"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
