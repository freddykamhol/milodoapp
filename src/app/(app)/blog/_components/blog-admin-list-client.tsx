"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { Badge, type BadgeTone } from "../../_components/ui";

export type BlogAdminRow = {
  id: number;
  title: string;
  category: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAtIso: string | null;
};

function statusTone(status: string): BadgeTone {
  if (status === "PUBLISHED") return "success";
  if (status === "ARCHIVED") return "danger";
  return "muted";
}

const ALL_STATUSES: Array<BlogAdminRow["status"]> = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export function BlogAdminListClient({ initialRows }: { initialRows: BlogAdminRow[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<BlogAdminRow[]>(initialRows);

  const [openMenuForId, setOpenMenuForId] = React.useState<number | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuAnchorRef = React.useRef<HTMLButtonElement | null>(null);

  const [statusModal, setStatusModal] = React.useState<{ id: number; current: BlogAdminRow["status"] } | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

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
    const width = 240;
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

  async function deletePost(id: number) {
    if (!window.confirm("Beitrag wirklich löschen?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/blog/posts/${id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "delete_failed");
      setRows((cur) => cur.filter((r) => r.id !== id));
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
      window.alert(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function updateStatus(id: number, status: BlogAdminRow["status"]) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/blog/posts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "status_failed");
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)));
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Status ändern fehlgeschlagen.";
      window.alert(msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      {rows.length ? (
        rows.map((r) => (
          <Link
            key={r.id}
            href={`/blog/${r.id}`}
            className="flex flex-col gap-2 px-4 py-3 transition hover:bg-[var(--surface-2)] md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{r.title || "(ohne Titel)"}</p>
              <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                {r.category} · {r.slug || "—"} · {r.updatedAtIso ? new Date(r.updatedAtIso).toLocaleString("de-DE") : "—"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={statusTone(String(r.status || ""))}>{String(r.status || "")}</Badge>

              <button
                type="button"
                disabled={busyId === r.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  menuAnchorRef.current = e.currentTarget as HTMLButtonElement;
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  const width = 240;
                  const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
                  const belowTop = rect.bottom + 10;
                  setMenuPos({ top: belowTop, left });
                  setOpenMenuForId((cur) => (cur === r.id ? null : r.id));
                  window.setTimeout(() => updateMenuPosition(), 0);
                }}
                className="list-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.05)] transition hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)] disabled:opacity-60"
                aria-label="Aktionen"
                aria-expanded={openMenuForId === r.id}
              >
                ⋯
              </button>

              {openMenuForId === r.id && menuPos
                ? createPortal(
                    <div
                      ref={menuRef}
                      className="fixed z-[60] w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
                      style={{ top: menuPos.top, left: menuPos.left }}
                      role="menu"
                      aria-label="Beitrag Aktionen"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <button
                        type="button"
                        className="block w-full px-4 py-3 text-left text-xs font-semibold hover:bg-[var(--surface-2)]"
                        onClick={() => {
                          setOpenMenuForId(null);
                          router.push(`/blog/${r.id}`);
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className="block w-full px-4 py-3 text-left text-xs font-semibold hover:bg-[var(--surface-2)]"
                        onClick={() => {
                          setOpenMenuForId(null);
                          setStatusModal({ id: r.id, current: r.status });
                        }}
                      >
                        Status ändern…
                      </button>
                      <button
                        type="button"
                        className="block w-full px-4 py-3 text-left text-xs font-semibold text-[color:var(--danger)] hover:bg-[color:color-mix(in_oklab,var(--danger)_10%,transparent)]"
                        onClick={() => {
                          setOpenMenuForId(null);
                          void deletePost(r.id);
                        }}
                      >
                        Löschen
                      </button>
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </Link>
        ))
      ) : (
        <div className="px-4 py-6 text-sm text-[color:var(--muted)]">Noch keine Blog-Beiträge vorhanden.</div>
      )}

      {statusModal
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setStatusModal(null)}
            >
              <div
                className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-semibold">Status ändern</p>
                <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
                  Wähle den neuen Status.
                </p>

                <label className="mt-4 block">
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Neuer Status</span>
                  <select
                    className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                    defaultValue=""
                    onChange={(e) => {
                      const next = e.target.value as BlogAdminRow["status"];
                      if (!next) return;
                      const id = statusModal.id;
                      setStatusModal(null);
                      void updateStatus(id, next);
                    }}
                  >
                    <option value="" disabled>
                      Bitte auswählen…
                    </option>
                    {ALL_STATUSES.filter((s) => s !== statusModal.current).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                    onClick={() => setStatusModal(null)}
                  >
                    Abbrechen
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

