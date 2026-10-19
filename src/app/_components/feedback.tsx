"use client";

import * as React from "react";
import { createPortal } from "react-dom";

type Request = { message: string; kind: "confirm" | "prompt"; inputType?: "text" | "password"; initial?: string; resolve: (value: string | boolean | null) => void };
const pending: Request[] = [];
function enqueue(request: Request) { pending.push(request); window.dispatchEvent(new Event("milodo:dialog")); }
export function notify(message: unknown) { window.dispatchEvent(new CustomEvent("milodo:toast", { detail: String(message ?? "") })); }
export function confirmAction(message: string): Promise<boolean> { return new Promise((resolve) => enqueue({ message, kind: "confirm", resolve: (value) => resolve(value === true) })); }
export function requestText(message: string, initial = ""): Promise<string | null> { return new Promise((resolve) => enqueue({ message, kind: "prompt", initial, resolve: (value) => resolve(typeof value === "string" ? value : null) })); }
export function requestPassword(message: string): Promise<string | null> { return new Promise((resolve) => enqueue({ message, kind: "prompt", inputType: "password", resolve: (value) => resolve(typeof value === "string" ? value : null) })); }

export function FeedbackHost() {
  const [request, setRequest] = React.useState<Request | null>(null);
  const [text, setText] = React.useState("");
  const [toasts, setToasts] = React.useState<{ id: number; text: string }[]>([]);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const active = React.useRef(false);
  const timers = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const titleId = React.useId();

  React.useEffect(() => {
    const next = () => { if (active.current) return; const item = pending.shift(); if (item) { active.current = true; setText(item.initial ?? ""); setRequest(item); } };
    const toast = (event: Event) => { const textValue = (event as CustomEvent<string>).detail; const id = Date.now() + Math.random(); setToasts((items) => [...items.slice(-3), { id, text: textValue }]); const timer = setTimeout(() => { setToasts((items) => items.filter((item) => item.id !== id)); timers.current.delete(timer); }, 6500); timers.current.add(timer); };
    window.addEventListener("milodo:dialog", next); window.addEventListener("milodo:toast", toast); next();
    return () => { window.removeEventListener("milodo:dialog", next); window.removeEventListener("milodo:toast", toast); for (const timer of timers.current) clearTimeout(timer); };
  }, []);

  function finish(value: boolean | string | null) { request?.resolve(value); setRequest(null); active.current = false; setTimeout(() => window.dispatchEvent(new Event("milodo:dialog")), 0); }
  React.useEffect(() => {
    if (!request) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]') ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [request]);
  React.useEffect(() => { if (!request) return; const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; dialogRef.current?.querySelector<HTMLElement>("input,button")?.focus(); return () => { document.body.style.overflow = overflow; previous?.focus(); }; }, [request]);

  return <>{toasts.length ? createPortal(<div className="ui-toasts" aria-live="polite">{toasts.map((toast) => <div key={toast.id} role="status" className="ui-toast"><p>{toast.text}</p><button type="button" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))} aria-label="Hinweis schließen">×</button></div>)}</div>, document.body) : null}{request ? createPortal(<div className="ui-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) finish(request.kind === "prompt" ? null : false); }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="ui-dialog" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); finish(request.kind === "prompt" ? null : false); } }}><h2 id={titleId}>{request.kind === "prompt" ? "Angabe erforderlich" : "Bitte bestätigen"}</h2><p className="ui-dialog-message">{request.message}</p><form onSubmit={(event) => { event.preventDefault(); finish(request.kind === "prompt" ? text : true); }}>{request.kind === "prompt" ? <input type={request.inputType ?? "text"} className="ui-input" aria-label={request.message} value={text} onChange={(event) => setText(event.target.value)} /> : null}<div className="ui-dialog-actions"><button type="button" className="ui-button-secondary" onClick={() => finish(request.kind === "prompt" ? null : false)}>Abbrechen</button><button type="submit" className="ui-button-primary">{request.kind === "prompt" ? "Übernehmen" : "Bestätigen"}</button></div></form></div></div>, document.body) : null}</>;
}
