"use client";

import * as React from "react";

const LOGGED_OUT_KEY = "milodo:logged-out:v1";
const LAST_ACTIVE_KEY = "milodo:last-active:v1";
const IDLE_MS = 30 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function isLoggedOut() {
  try {
    return window.localStorage.getItem(LOGGED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function markActive() {
  try {
    window.localStorage.setItem(LAST_ACTIVE_KEY, String(nowMs()));
  } catch {
    // ignore
  }
}

function lastActiveMs() {
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : nowMs();
  } catch {
    return nowMs();
  }
}

export function logoutNow() {
  try {
    window.localStorage.setItem(LOGGED_OUT_KEY, "1");
  } catch {
    // ignore
  }
  window.location.href = "/signed-out";
}

export function SessionGuard() {
  React.useEffect(() => {
    if (isLoggedOut() && window.location.pathname !== "/signed-out") {
      window.location.href = "/signed-out";
      return;
    }

    markActive();

    let raf = 0;
    const scheduleActive = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => markActive());
    };

    const onAny = () => scheduleActive();

    window.addEventListener("pointerdown", onAny, { passive: true });
    window.addEventListener("keydown", onAny);
    window.addEventListener("scroll", onAny, true);
    window.addEventListener("touchstart", onAny, { passive: true });

    const t = window.setInterval(() => {
      if (isLoggedOut()) return;
      if (nowMs() - lastActiveMs() >= IDLE_MS) logoutNow();
    }, 15_000);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onAny);
      window.removeEventListener("keydown", onAny);
      window.removeEventListener("scroll", onAny, true);
      window.removeEventListener("touchstart", onAny);
      window.clearInterval(t);
    };
  }, []);

  return null;
}

