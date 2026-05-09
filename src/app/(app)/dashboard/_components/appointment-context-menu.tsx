"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type InquiryChannelResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; error: string; message?: string };

type InquiryApiResponse =
  | { ok: true; result?: { telegram: InquiryChannelResult; email: InquiryChannelResult; prowl: InquiryChannelResult } }
  | { ok: false; error?: string; message?: string; result?: { telegram: InquiryChannelResult; email: InquiryChannelResult; prowl: InquiryChannelResult } };

function HintModal({
  open,
  title,
  body,
  tone = "neutral",
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  tone?: "neutral" | "success" | "danger";
  onClose: () => void;
}) {
  if (!open) return null;
  const toneStyles =
    tone === "success"
      ? {
          headerBg: "bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]",
          dot: "bg-[color:var(--accent)]",
        }
      : tone === "danger"
        ? {
            headerBg: "bg-[color:color-mix(in_oklab,var(--danger)_10%,transparent)]",
            dot: "bg-[color:var(--danger)]",
          }
        : { headerBg: "bg-[var(--surface-2)]", dot: "bg-[color:var(--muted)]" };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className={["flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4", toneStyles.headerBg].join(" ")}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={["h-2.5 w-2.5 shrink-0 rounded-full", toneStyles.dot].join(" ")} aria-hidden="true" />
              <p className="truncate text-sm font-semibold">{title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)]"
          >
            Schließen
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[color:var(--muted)]">{body}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatInquiryResult(result: {
  telegram: InquiryChannelResult;
  email: InquiryChannelResult;
  prowl: InquiryChannelResult;
}) {
  const line = (label: string, r: InquiryChannelResult) => {
    if (r.ok) return `${label}: OK`;
    if (r.skipped) return `${label}: übersprungen (${r.error})`;
    return `${label}: FEHLER (${r.message || r.error})`;
  };
  return [line("Telegram", result.telegram), line("E-Mail", result.email), line("Prowl", result.prowl)].join("\n");
}

function getInquiryError(data: InquiryApiResponse | null) {
  if (!data || data.ok) return null;
  return { message: data.message || data.error || "failed", result: data.result };
}

export function AppointmentContextMenu({
  appointmentId,
  variant = "open",
  canManage = false,
  canReport = true,
  canTriggerAcuteInquiry = false,
  canTriggerInquiry = false,
}: {
  appointmentId: number;
  variant?: "open" | "confirmed";
  canManage?: boolean;
  canReport?: boolean;
  canTriggerAcuteInquiry?: boolean;
  canTriggerInquiry?: boolean;
}) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const [hint, setHint] = React.useState<{ title: string; body: string; tone?: "neutral" | "success" | "danger" } | null>(null);

  const updatePosition = React.useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 176; // w-44
    const viewportW = window.innerWidth;

    const left = Math.min(Math.max(12, rect.right - menuWidth), viewportW - menuWidth - 12);
    const belowTop = rect.bottom + 10;
    const aboveTop = rect.top - 10;

    const menu = menuRef.current;
    const h = menu ? menu.getBoundingClientRect().height : 0;
    const viewportH = window.innerHeight;
    const fitsBelow = h ? rect.bottom + 10 + h <= viewportH - 12 : true;
    const top = fitsBelow ? belowTop : Math.max(12, aboveTop - h);

    setPos({ top, left, placement: fitsBelow ? "bottom" : "top" });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const btn = buttonRef.current;
      const menu = menuRef.current;
      if (event.target instanceof Node && (btn?.contains(event.target) || menu?.contains(event.target))) return;
      setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
  };

  const navigateTo = async () => {
    close();
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/nav`, { method: "GET" });
      if (!res.ok) throw new Error("nav_failed");
      const data = (await res.json()) as { ok: boolean; destination?: string };
      const destination = String(data.destination ?? "").trim();
      if (!destination) throw new Error("no_destination");

      const ua = navigator.userAgent || "";
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const url = isIOS
        ? `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.alert("Navigation konnte nicht gestartet werden.");
    }
  };

  React.useEffect(() => {
    if (!open) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => updatePosition());
    };

    const t = window.setTimeout(schedule, 0);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [open, updatePosition]);

  return (
    <>
      <HintModal
        open={Boolean(hint)}
        title={hint?.title ?? ""}
        body={hint?.body ?? ""}
        tone={hint?.tone ?? "neutral"}
        onClose={() => setHint(null)}
      />
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="list-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.05)] transition hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]"
        aria-label="Aktionen"
        aria-expanded={open}
      >
        ⋯
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[60] w-44 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
              style={{ top: pos.top, left: pos.left }}
              role="menu"
              aria-label="Aktionen"
            >
              <Link
                href={`/appointments/${appointmentId}`}
                onClick={close}
                className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
              >
                Details
              </Link>
              <button
                type="button"
                onClick={() => void navigateTo()}
                className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-2)]"
              >
                Navigieren
              </button>

              {canManage ? (
                <>
                  <Link
                    href={`/appointments/${appointmentId}/edit`}
                    onClick={close}
                    className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                  >
                    Bearbeiten
                  </Link>
                  {canTriggerInquiry ? (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={async () => {
                        close();
                        try {
                          setIsSubmitting(true);
                          const res = await fetch(`/api/appointments/${appointmentId}/admin/inquiry`, {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ kind: "REQUESTS_GENERAL" }),
                          });
                          const data = (await res.json().catch(() => null)) as InquiryApiResponse | null;
                          if (!res.ok || !data?.ok) {
                            const err = getInquiryError(data);
                            const details = err?.result ? `\n\n${formatInquiryResult(err.result)}` : "";
                            throw new Error(`${err?.message || "inquiry_failed"}${details}`);
                          }
                          setHint({
                            title: "Abfrage ausgelöst",
                            body: "Ausgelöst. Benachrichtigungen werden jetzt versendet.",
                            tone: "success",
                          });
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Abfrage fehlgeschlagen.";
                          setHint({
                            title: "Abfrage fehlgeschlagen",
                            body: `${msg}\n\nTipp: Integrationen → Telegram-Test ausführen.`,
                            tone: "danger",
                          });
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
                    >
                      Abfrage auslösen
                    </button>
                  ) : null}
                  {canTriggerAcuteInquiry ? (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={async () => {
                        close();
                        try {
                          setIsSubmitting(true);
                          const res = await fetch(`/api/appointments/${appointmentId}/admin/inquiry`, {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ kind: "URGENT_REQUESTS" }),
                          });
                          const data = (await res.json().catch(() => null)) as InquiryApiResponse | null;
                          if (!res.ok || !data?.ok) {
                            const err = getInquiryError(data);
                            const details = err?.result ? `\n\n${formatInquiryResult(err.result)}` : "";
                            throw new Error(`${err?.message || "acute_failed"}${details}`);
                          }
                          setHint({
                            title: "Akutabfrage ausgelöst",
                            body: "Ausgelöst. Benachrichtigungen werden jetzt versendet.",
                            tone: "success",
                          });
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Akutabfrage fehlgeschlagen.";
                          setHint({
                            title: "Akutabfrage fehlgeschlagen",
                            body: `${msg}\n\nTipp: Integrationen → Telegram-Test ausführen. Wenn der Test klappt, stimmt meist der Chat/Token; dann ist es oft ein Payload/Parse-Problem.`,
                            tone: "danger",
                          });
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      className="block w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[var(--surface-2)] disabled:opacity-60"
                    >
                      Akutabfrage auslösen
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={async () => {
                      close();
                      if (!confirm("Termin wirklich löschen?")) return;
                      try {
                        setIsSubmitting(true);
                        const res = await fetch(`/api/appointments/${appointmentId}`, { method: "DELETE" });
                        if (!res.ok) throw new Error("delete_failed");
                        router.refresh();
                      } catch {
                        window.alert("Löschen fehlgeschlagen.");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="block w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[var(--surface-2)] disabled:opacity-60"
                  >
                    Löschen
                  </button>
                  <div className="border-t border-[var(--border)]" />
                </>
              ) : (
                <div className="border-t border-[var(--border)]" />
              )}
              {variant === "open" ? (
                <button
                  type="button"
                  disabled={isSubmitting || !canReport}
                  onClick={async () => {
                    close();
                    try {
                      setIsSubmitting(true);
                      const res = await fetch(`/api/appointments/${appointmentId}/report`, {
                        method: "POST",
                      });
                      if (!res.ok) throw new Error("report_failed");
                      setHint({
                        title: "Gemeldet",
                        body: "Du hast dich gemeldet. Eine Bestätigung wurde als Benachrichtigung hinterlegt und per E-Mail versendet (falls SMTP aktiv).",
                        tone: "success",
                      });
                      window.dispatchEvent(new CustomEvent("milodo:notifications:refresh"));
                      router.refresh();
                    } catch {
                      setHint({
                        title: "Melden fehlgeschlagen",
                        body: "Bitte später erneut versuchen.",
                        tone: "danger",
                      });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="block w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--accent)] hover:bg-[var(--surface-2)] disabled:opacity-60"
                >
                  {canReport ? "Melden" : "Bereits besetzt"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    close();
                    window.alert("Absage ist noch nicht verdrahtet (Backend folgt).");
                  }}
                  className="block w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[var(--surface-2)] disabled:opacity-60"
                >
                  Absage
                </button>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
