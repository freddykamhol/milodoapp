"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Category = "CV" | "TRAINING" | "CONTRACT";

function titleFromFileName(name: string) {
  const base = name.replace(/\.[a-z0-9]{1,8}$/i, "");
  const cleaned = base.replaceAll(/[_\-]+/g, " ").trim();
  return cleaned.slice(0, 120) || "Dokument";
}

export function DocumentDropzone({
  ownerId,
  category,
  label,
  description,
  keepFileName = true,
}: {
  ownerId: number;
  category: Category;
  label: string;
  description: string;
  keepFileName?: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  async function upload(file: File) {
    setIsUploading(true);
    try {
      const form = new FormData();
      form.set("ownerId", String(ownerId));
      form.set("category", category);
      form.set("title", titleFromFileName(file.name));
      form.set("keepFileName", keepFileName ? "1" : "0");
      form.set("file", file);

      const res = await fetch("/api/documents/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        window.alert(data?.message || "Upload fehlgeschlagen.");
        return;
      }

      router.refresh();
    } catch {
      window.alert("Upload fehlgeschlagen.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      className={[
        "rounded-2xl border border-dashed p-6 text-center transition",
        isDragging
          ? "border-[color:var(--ring)] bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
          : "border-[var(--border)] bg-[var(--surface-2)]",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      aria-label={`${label} hochladen`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (file) void upload(file);
          e.currentTarget.value = "";
        }}
      />

      <p className="text-sm font-semibold">
        {isUploading ? "Upload läuft…" : isDragging ? "Loslassen zum Hochladen" : label}
      </p>
      <p className="mt-1 text-xs text-[color:var(--muted)]">{description}</p>
      <p className="mt-3 text-[11px] font-medium text-[color:var(--muted)]">
        Drag & Drop oder klicken • Titel wird aus Dateiname übernommen
      </p>
    </div>
  );
}
