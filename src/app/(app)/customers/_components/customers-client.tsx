"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { Badge } from "../../_components/ui";

type Row = {
  id: number;
  name: string;
  mainBereich: string;
  contactName: string;
  street: string;
  houseNumber: string;
  plz: string;
  city: string;
  email: string;
  accountUserId: number | null;
  accountLocked: boolean | null;
  accountUsername: string | null;
};

export function CustomersClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [openMenuForId, setOpenMenuForId] = React.useState<number | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!openMenuForId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuForId(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      if (menu.contains(e.target as Node)) return;
      setOpenMenuForId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openMenuForId]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px] overflow-hidden rounded-2xl border border-[var(--border)]">
        <div className="grid grid-cols-[1fr_170px_180px_220px] gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]">
          <div>Firma</div>
          <div>Hauptbereich</div>
          <div>Kontakt</div>
          <div className="text-right">Aktion</div>
        </div>
        <ul className="divide-y divide-[var(--border)] bg-[var(--surface)]">
          {initial.map((c) => {
            const address = [c.street, c.houseNumber].filter(Boolean).join(" ").trim() || "—";
            const city = [c.plz, c.city].filter(Boolean).join(" ").trim() || "—";
            const canAccountActions = Boolean(c.accountUserId);
            const lockLabel = c.accountLocked ? "Entsperren" : "Sperren";

            return (
              <li key={c.id} className="grid grid-cols-[1fr_170px_180px_220px] items-center gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                    {address} • {city}
                  </p>
                  {c.accountUsername ? (
                    <p className="mt-1 truncate text-xs font-semibold text-[color:var(--muted)]">
                      Login: {c.accountUsername}
                    </p>
                  ) : null}
                </div>
                <div>
                  <Badge tone="muted">{c.mainBereich}</Badge>
                </div>
                <div className="min-w-0 text-xs font-semibold text-[color:var(--muted)]">
                  <p className="truncate">{c.contactName || "—"}</p>
                  <p className="truncate">{c.email || "—"}</p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      const width = 208;
                      const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
                      const belowTop = rect.bottom + 10;
                      const aboveTop = rect.top - 10;
                      setMenuPos({ top: belowTop, left });
                      setOpenMenuForId((cur) => (cur === c.id ? null : c.id));

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
                    aria-expanded={openMenuForId === c.id}
                  >
                    ⋯
                  </button>

                  {openMenuForId === c.id && menuPos
                    ? createPortal(
                        <div
                          ref={menuRef}
                          className="fixed z-[60] w-52 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
                          style={{ top: menuPos.top, left: menuPos.left }}
                          role="menu"
                          aria-label="Aktionen"
                        >
                          <Link
                            href={`/customers/${c.id}/edit`}
                            onClick={() => setOpenMenuForId(null)}
                            className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                          >
                            Details
                          </Link>
                          <Link
                            href={`/customers/${c.id}/edit`}
                            onClick={() => setOpenMenuForId(null)}
                            className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                          >
                            Bearbeiten
                          </Link>
                          <button
                            type="button"
                            disabled={!canAccountActions}
                            onClick={async () => {
                              setOpenMenuForId(null);
                              if (!c.accountUserId) return;
                              const ok = window.confirm(`${lockLabel}: ${c.accountUsername ?? "Kundenlogin"}?`);
                              if (!ok) return;
                              const res = await fetch(`/api/members/${c.accountUserId}/lock`, { method: "PATCH" });
                              if (!res.ok) {
                                window.alert("Aktion fehlgeschlagen.");
                                return;
                              }
                              router.refresh();
                            }}
                            className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-2)] disabled:opacity-50"
                          >
                            {lockLabel}
                          </button>
                          <button
                            type="button"
                            disabled={!canAccountActions}
                            onClick={async () => {
                              setOpenMenuForId(null);
                              if (!c.accountUserId) return;
                              const ok = window.confirm(`Passwort zurücksetzen für ${c.accountUsername ?? "Kundenlogin"}?`);
                              if (!ok) return;
                              const res = await fetch(`/api/members/${c.accountUserId}/reset-password`, { method: "POST" });
                              const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
                              if (!res.ok || !json?.ok) {
                                window.alert("Zurücksetzen fehlgeschlagen.");
                                return;
                              }
                              window.alert("E-Mail wurde versendet (falls SMTP aktiv).");
                            }}
                            className="block w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--accent)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                          >
                            Passwort zurücksetzen
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setOpenMenuForId(null);
                              const ok = window.confirm(`Kunde wirklich löschen: ${c.name}?`);
                              if (!ok) return;
                              const res = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
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
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

