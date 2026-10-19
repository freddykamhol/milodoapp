"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";

export function ApprovalActions({ documentId }: { documentId: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/documents/${documentId}/approve-expiry`, { method: "POST" });
        if (!response.ok) throw new Error("Der Antrag wurde bereits bearbeitet oder konnte nicht genehmigt werden.");
        router.push("/documents#pending-approvals");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Genehmigung fehlgeschlagen.");
        setBusy(false);
      }
    }} className="rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Wird genehmigt …" : "Ablaufdatum genehmigen"}</button>
    <Link href="/documents#pending-approvals" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold">Zurück zu ausstehenden Anträgen</Link>
    {error ? <p role="alert" className="w-full text-sm text-red-700">{error}</p> : null}
  </div>;
}
