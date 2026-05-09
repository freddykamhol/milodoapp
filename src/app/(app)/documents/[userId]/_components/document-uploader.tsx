"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Category = "CV" | "TRAINING" | "CONTRACT";

function label(category: Category) {
  if (category === "CV") return "Lebenslauf";
  if (category === "TRAINING") return "Aus- und Fortbildungsnachweise";
  return "Arbeitsverträge";
}

export function DocumentUploader({
  ownerId,
  canUpload,
}: {
  ownerId: number;
  canUpload: boolean;
}) {
  const router = useRouter();
  const [category, setCategory] = React.useState<Category>("CV");
  const [title, setTitle] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [keepFileName, setKeepFileName] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!canUpload) return null;

  return (
    <form
      className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setIsSubmitting(true);
        try {
          const form = new FormData();
          form.set("ownerId", String(ownerId));
          form.set("category", category);
          form.set("title", title.trim());
          form.set("keepFileName", keepFileName ? "1" : "0");
          form.set("file", file);

          const res = await fetch("/api/documents/upload", { method: "POST", body: form });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { message?: string } | null;
            throw new Error(data?.message || "upload_failed");
          }

          setTitle("");
          setFile(null);
          router.refresh();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Upload fehlgeschlagen.";
          window.alert(msg || "Upload fehlgeschlagen.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Upload</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Sichtbar nur für das Mitglied und Admin/Verwaltung.
          </p>
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !file}
          className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
        >
          Hochladen
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Bereich</span>
          <select
            className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            <option value="CV">{label("CV")}</option>
            <option value="TRAINING">{label("TRAINING")}</option>
            <option value="CONTRACT">{label("CONTRACT")}</option>
          </select>
        </label>

        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Titel</span>
          <input
            className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--ring)]"
            placeholder="z.B. Lebenslauf 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="block md:col-span-3">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Dateiname</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
            <input
              type="checkbox"
              checked={keepFileName}
              onChange={(e) => setKeepFileName(e.target.checked)}
            />
            <span className="text-xs font-semibold text-[color:var(--muted)]">
              Dateiname beibehalten (sonst wird er aus dem Titel gebaut)
            </span>
          </div>
        </label>

        <label className="block md:col-span-3">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Datei</span>
          <input
            type="file"
            className="mt-1 block w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-[11px] font-medium text-[color:var(--muted)]">
            {file ? `Ausgewählt: ${file.name}` : "PDF, JPG, PNG • max. 25MB"}
          </p>
        </label>
      </div>
    </form>
  );
}
