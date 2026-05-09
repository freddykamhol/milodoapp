"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { Badge } from "../../_components/ui";

export type MemberItem = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  geb: string | null;
  qualRD: string | null;
  qualAusb: string | null;
  einsatzort: string | null;
  locked?: boolean;
};

type FilterState = {
  q: string;
  role: string;
  qualRD: string;
  qualAusb: string;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function isBirthdayToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
}

export function MembersClient({
  members,
  canCreate,
  canManage,
}: {
  members: MemberItem[];
  canCreate: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [openMenuForId, setOpenMenuForId] = React.useState<number | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const [filter, setFilter] = React.useState<FilterState>({
    q: "",
    role: "",
    qualRD: "",
    qualAusb: "",
  });

  const birthdays = React.useMemo(
    () => members.filter((m) => isBirthdayToday(m.geb)),
    [members],
  );

  const filtered = React.useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return members.filter((m) => {
      if (q) {
        const hay = `${m.lastName} ${m.firstName} ${m.username} ${m.role} ${m.qualRD ?? ""} ${m.qualAusb ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.role && m.role !== filter.role) return false;
      if (filter.qualRD && (m.qualRD ?? "") !== filter.qualRD) return false;
      if (filter.qualAusb && (m.qualAusb ?? "") !== filter.qualAusb) return false;
      return true;
    });
  }, [filter, members]);

  const roles = React.useMemo(() => Array.from(new Set(members.map((m) => m.role))).sort(), [members]);
  const qualRDs = React.useMemo(
    () => Array.from(new Set(members.map((m) => m.qualRD).filter(Boolean) as string[])).sort(),
    [members],
  );
  const qualAusbs = React.useMemo(
    () => Array.from(new Set(members.map((m) => m.qualAusb).filter(Boolean) as string[])).sort(),
    [members],
  );

  React.useEffect(() => {
    if (!openMenuForId) return;
    function onPointerDown(event: MouseEvent) {
      const menu = menuRef.current;
      const anchor = menuAnchorRef.current;
      if (event.target instanceof Node && (menu?.contains(event.target) || anchor?.contains(event.target))) return;
      setOpenMenuForId(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openMenuForId]);

  const updateMenuPosition = React.useCallback(() => {
    const anchor = menuAnchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = 208; // w-52
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    const belowTop = rect.bottom + 10;
    const aboveTop = rect.top - 10;
    const menu = menuRef.current;
    const h = menu ? menu.getBoundingClientRect().height : 0;
    const fitsBelow = h ? rect.bottom + 10 + h <= window.innerHeight - 12 : true;
    const top = fitsBelow ? belowTop : Math.max(12, aboveTop - h);
    setMenuPos({ top, left });
  }, []);

  React.useEffect(() => {
    if (!openMenuForId) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => updateMenuPosition());
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
  }, [openMenuForId, updateMenuPosition]);

  return (
    <div className="flex flex-col gap-4">
      {birthdays.length ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-sm font-semibold">Heute Geburtstag</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {birthdays.map((b) => `${b.firstName} ${b.lastName}`.trim() || b.username).join(", ")}
          </p>
        </div>
      ) : null}

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Filter</p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Suche nach Name/Rolle/Qualifikation.
            </p>
          </div>
          {canCreate ? (
            <Link
              href="/members/new"
              className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
            >
              Mitglied anlegen
            </Link>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Suche</span>
            <input
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--ring)]"
              placeholder="Name, Rolle, Qual…"
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Rolle</span>
            <select
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
              value={filter.role}
              onChange={(e) => setFilter((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="">Alle</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Qualifikation RD</span>
            <select
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
              value={filter.qualRD}
              onChange={(e) => setFilter((f) => ({ ...f, qualRD: e.target.value }))}
            >
              <option value="">Alle</option>
              {qualRDs.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Qualifikation Ausbildung</span>
            <select
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
              value={filter.qualAusb}
              onChange={(e) => setFilter((f) => ({ ...f, qualAusb: e.target.value }))}
            >
              <option value="">Alle</option>
              {qualAusbs.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          <div className="block">
            <span className="text-xs font-semibold text-transparent">Label</span>
            <button
              type="button"
              onClick={() => setFilter({ q: "", role: "", qualRD: "", qualAusb: "" })}
              className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.05)] hover:bg-[var(--surface-2)]"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div
          className={[
            "min-w-[740px] grid gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]",
            canManage ? "grid-cols-[160px_160px_150px_1fr_44px]" : "grid-cols-[160px_160px_150px_1fr]",
          ].join(" ")}
        >
          <div>Name</div>
          <div>Vorname</div>
          <div>Geburtstag</div>
          <div>Qualifikationen</div>
          {canManage ? <div className="text-right">Aktion</div> : null}
        </div>
        <ul className="min-w-[740px] divide-y divide-[var(--border)]">
          {filtered.map((m) => (
            <li
              key={m.id}
              className={[
                "grid items-center gap-3 px-4 py-3",
                canManage ? "grid-cols-[160px_160px_150px_1fr_44px]" : "grid-cols-[160px_160px_150px_1fr]",
              ].join(" ")}
            >
              <div className="min-w-0">
                <Link
                  href={`/members/${m.id}`}
                  className="block truncate text-sm font-semibold hover:underline"
                >
                  {m.lastName || "—"}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="muted">@{m.username}</Badge>
                  {m.locked ? <Badge tone="danger">Gesperrt</Badge> : null}
                </div>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{m.firstName || "—"}</p>
                <p className="mt-1 truncate text-xs font-semibold text-[color:var(--muted)]">{m.role}</p>
              </div>
              <div className="text-xs font-semibold text-[color:var(--muted)]">
                {m.geb ? formatDate(new Date(m.geb)) : "—"}
              </div>
              <div className="min-w-0 text-xs font-semibold text-[color:var(--muted)]">
                <p className="truncate">{[m.qualRD, m.qualAusb].filter(Boolean).join(" • ") || "—"}</p>
              </div>
              {canManage ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      menuAnchorRef.current = e.currentTarget as HTMLButtonElement;
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      const width = 208; // w-52
                      const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
                      const belowTop = rect.bottom + 10;
                      const aboveTop = rect.top - 10;
                      setMenuPos({ top: belowTop, left });
                      setOpenMenuForId((cur) => (cur === m.id ? null : m.id));

                      window.setTimeout(() => {
                        const menu = menuRef.current;
                        if (!menu) return;
                        const h = menu.getBoundingClientRect().height;
                        const fitsBelow = rect.bottom + 10 + h <= window.innerHeight - 12;
                        setMenuPos({ top: fitsBelow ? belowTop : Math.max(12, aboveTop - h), left });
                      }, 0);
                    }}
                    className="list-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.05)] transition hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)]"
                    aria-label="Aktionen"
                    aria-expanded={openMenuForId === m.id}
                  >
                    ⋯
                  </button>

                  {openMenuForId === m.id && menuPos
                    ? createPortal(
                        <div
                          ref={menuRef}
                          className="fixed z-[60] w-52 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
                          style={{ top: menuPos.top, left: menuPos.left }}
                          role="menu"
                          aria-label="Aktionen"
                        >
                          <Link
                            href={`/members/${m.id}`}
                            onClick={() => setOpenMenuForId(null)}
                            className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                          >
                            Details
                          </Link>
                          <Link
                            href={`/members/${m.id}/edit`}
                            onClick={() => setOpenMenuForId(null)}
                            className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                          >
                            Bearbeiten
                          </Link>
                          <button
                            type="button"
                            onClick={async () => {
                              setOpenMenuForId(null);
                              const ok = window.confirm(`${m.locked ? "Entsperren" : "Sperren"}: ${m.username}?`);
                              if (!ok) return;
                              const res = await fetch(`/api/members/${m.id}/lock`, { method: "PATCH" });
                              if (!res.ok) {
                                window.alert("Aktion fehlgeschlagen.");
                                return;
                              }
                              router.refresh();
                            }}
                            className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-2)]"
                          >
                            {m.locked ? "Entsperren" : "Sperren"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setOpenMenuForId(null);
                              const ok = window.confirm(`Passwort zurücksetzen für ${m.username}?`);
                              if (!ok) return;
                              const res = await fetch(`/api/members/${m.id}/reset-password`, { method: "POST" });
                              const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
                              if (!res.ok || !json?.ok) {
                                window.alert("Zurücksetzen fehlgeschlagen.");
                                return;
                              }
                              window.alert("Reset-Link wurde per E-Mail versendet (falls SMTP aktiv).");
                            }}
                            className="block w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--accent)] hover:bg-[var(--surface-2)]"
                          >
                            Passwort zurücksetzen
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setOpenMenuForId(null);
                              const ok = window.confirm(`Mitglied wirklich löschen: ${m.username}?`);
                              if (!ok) return;
                              const res = await fetch(`/api/members/${m.id}`, { method: "DELETE" });
                              if (!res.ok) {
                                window.alert("Löschen fehlgeschlagen.");
                                return;
                              }
                              router.refresh();
                            }}
                            className="block w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[var(--surface-2)]"
                          >
                            Löschen
                          </button>
                        </div>,
                        document.body,
                      )
                    : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[color:var(--muted)]">Keine Mitglieder gefunden.</p>
        ) : null}
      </div>
    </div>
  );
}
