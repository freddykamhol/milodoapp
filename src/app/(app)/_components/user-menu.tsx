"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

import { IconLogout } from "./icons";
import { logoutNow } from "./session-guard";

const LAST_ACTIVE_KEY = "milodo:last-active:v1";
const IDLE_MS = 30 * 60 * 1000;

function lastActiveMs() {
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : Date.now();
  } catch {
    return Date.now();
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type UserMenuProps = {
  displayName: string;
  roleLabel: string;
  initials: string;
};

export function UserMenu({ displayName, roleLabel, initials }: UserMenuProps) {
  const chipRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const [remainingMs, setRemainingMs] = React.useState(IDLE_MS);

  const updateRemaining = React.useCallback(() => {
    setRemainingMs(Math.max(0, IDLE_MS - (Date.now() - lastActiveMs())));
  }, []);

  const updateMenuPosition = React.useCallback(() => {
    const anchor = chipRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = 220;
    const left = clamp(rect.right - width, 12, window.innerWidth - width - 12);
    const belowTop = rect.bottom + 10;
    const aboveTop = rect.top - 10;
    const menu = menuRef.current;
    const h = menu ? menu.getBoundingClientRect().height : 0;
    const fitsBelow = h ? rect.bottom + 10 + h <= window.innerHeight - 12 : true;
    const top = fitsBelow ? belowTop : Math.max(12, aboveTop - h);
    setPos({ top, left });
  }, []);

  React.useEffect(() => {
    const initial = window.setTimeout(() => updateRemaining(), 0);
    const t = window.setInterval(() => updateRemaining(), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(t);
    };
  }, [updateRemaining]);

  React.useEffect(() => {
    if (!open) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => updateMenuPosition());
    };
    const timeout = window.setTimeout(schedule, 0);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [open, updateMenuPosition]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const anchor = chipRef.current;
      const menu = menuRef.current;
      if (event.target instanceof Node && (anchor?.contains(event.target) || menu?.contains(event.target))) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const progress = remainingMs / IDLE_MS;
  const progressElapsed = 1 - progress;
  const ringDeg = clamp(progressElapsed * 360, 0, 360);

  return (
    <div className="flex items-center gap-2">
      <button
        ref={chipRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 hover:bg-[var(--surface-2)]"
        aria-label="User Menü"
        aria-expanded={open}
      >
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--accent)]">
          <span className="text-xs font-semibold">{initials}</span>
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold leading-none">{displayName}</p>
          <p className="mt-1 text-[11px] leading-none text-[color:var(--muted)]">{roleLabel}</p>
        </div>
      </button>

      <div
        className="relative h-10 w-10 rounded-2xl p-[2px] shadow-[0_10px_24px_rgba(11,18,32,0.06)]"
        style={{
          background: `conic-gradient(from -90deg, rgba(239,68,68,0.95) 0deg ${ringDeg}deg, rgba(239,68,68,0.16) ${ringDeg}deg 360deg)`,
        }}
        aria-hidden="true"
      >
        <button
          type="button"
          onClick={() => logoutNow()}
          className="grid h-full w-full place-items-center rounded-[14px] bg-[var(--surface)] text-[color:var(--danger)] transition hover:bg-[var(--surface-2)]"
          aria-label="Logout"
          title="Auto-Logout in 30 Minuten"
        >
          <IconLogout className="h-4 w-4" />
        </button>
      </div>

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[60] w-[220px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
              style={{ top: pos.top, left: pos.left }}
              role="menu"
              aria-label="User Menü"
            >
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
              >
                Mein Profil
              </Link>
              <Link
                href="/profile/password"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
              >
                Passwort zurücksetzen
              </Link>
              <div className="border-t border-[var(--border)] px-3 py-2 text-[11px] font-semibold text-[color:var(--muted)]">
                Auto-Logout: {Math.ceil(remainingMs / 60000)} min
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
