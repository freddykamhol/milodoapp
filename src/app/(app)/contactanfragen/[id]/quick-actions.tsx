"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

function norm(value: string) {
  return String(value ?? "").trim();
}

export default function ContactInquiryActions(props: { inquiryId: number; email: string; ip: string; mode: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [forwardOpen, setForwardOpen] = React.useState(false);
  const [forwardTo, setForwardTo] = React.useState("");
  const [forwardError, setForwardError] = React.useState<string | null>(null);
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [replySubject, setReplySubject] = React.useState(`Re: Kontaktanfrage #${props.inquiryId} (${props.mode})`);
  const [replyMessage, setReplyMessage] = React.useState("Hallo,\n\nvielen Dank für deine Anfrage.\n\n—\nMilodo Medical");
  const [replyError, setReplyError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    const anyOpen = forwardOpen || replyOpen;
    if (!anyOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, forwardOpen, replyOpen]);

  async function doDelete() {
    if (!confirm("Kontaktanfrage wirklich löschen?")) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/contact-inquiries/${props.inquiryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      router.push("/contactanfragen");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function doBlockIp() {
    if (!props.ip) return;
    if (!confirm(`IP wirklich blockieren?\n\n${props.ip}`)) return;
    setBusy("block");
    try {
      const res = await fetch(`/api/contact-inquiries/${props.inquiryId}/block-ip`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Blocked via portal UI" }),
      });
      if (!res.ok) throw new Error("block_failed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function doForward() {
    setBusy("forward");
    setForwardError(null);
    try {
      const to = norm(forwardTo).toLowerCase();
      const res = await fetch(`/api/contact-inquiries/${props.inquiryId}/forward`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "forward_failed");
      setForwardOpen(false);
      setForwardTo("");
    } catch (e) {
      setForwardError(e instanceof Error ? e.message : "forward_failed");
    } finally {
      setBusy(null);
    }
  }

  async function doReply() {
    setBusy("reply");
    setReplyError(null);
    try {
      const res = await fetch(`/api/contact-inquiries/${props.inquiryId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: norm(replySubject), message: norm(replyMessage) }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "reply_failed");
      setReplyOpen(false);
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "reply_failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setReplyOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)]"
      >
        Antworten…
      </button>

      <button
        type="button"
        onClick={() => setForwardOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)]"
      >
        Weiterleiten…
      </button>

      <button
        type="button"
        disabled={!props.ip || busy === "block"}
        onClick={() => void doBlockIp()}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)] disabled:opacity-50"
      >
        IP blockieren
      </button>

      <button
        type="button"
        disabled={busy === "delete"}
        onClick={() => void doDelete()}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        Löschen
      </button>

      {mounted && forwardOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/10 backdrop-blur-3xl backdrop-saturate-150 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Weiterleiten"
              onClick={(e) => {
                if (e.target === e.currentTarget) setForwardOpen(false);
              }}
            >
              <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
                <div className="text-lg font-semibold tracking-tight">Weiterleiten</div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Zieladresse eingeben. Versand erfolgt über die SMTP-Einstellungen im Portal.
                </p>
                <div className="mt-4 grid gap-2">
                  <input
                    className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none focus:border-[color:var(--ring)]"
                    placeholder="name@domain.tld"
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                  />
                  {forwardError ? <div className="text-sm text-red-700">Fehler: {forwardError}</div> : null}
                </div>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForwardOpen(false);
                      setForwardError(null);
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)]"
                    disabled={busy === "forward"}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={() => void doForward()}
                    disabled={busy === "forward" || !norm(forwardTo).includes("@")}
                    className="inline-flex h-10 items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === "forward" ? "Sende…" : "Weiterleiten"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {mounted && replyOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/10 backdrop-blur-3xl backdrop-saturate-150 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Antworten"
              onClick={(e) => {
                if (e.target === e.currentTarget) setReplyOpen(false);
              }}
            >
              <div className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
                <div className="text-lg font-semibold tracking-tight">Antworten</div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Versand erfolgt über die SMTP-Einstellungen im Portal.
                </p>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-1">
                    <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">An</div>
                    <input
                      className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none"
                      value={props.email}
                      readOnly
                    />
                  </div>
                  <div className="grid gap-1">
                    <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Betreff</div>
                    <input
                      className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none focus:border-[color:var(--ring)]"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <div className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Nachricht</div>
                    <textarea
                      className="min-h-40 rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm outline-none focus:border-[color:var(--ring)]"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                    />
                  </div>
                  {replyError ? <div className="text-sm text-red-700">Fehler: {replyError}</div> : null}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyOpen(false);
                      setReplyError(null);
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)]"
                    disabled={busy === "reply"}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={() => void doReply()}
                    disabled={busy === "reply" || !norm(replySubject) || !norm(replyMessage)}
                    className="inline-flex h-10 items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === "reply" ? "Sende…" : "Antwort senden"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
