import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { ensureBlogSchema } from "@/lib/blog-schema";
import { getViewer } from "@/lib/viewer";

type Block = { id: string; type: string; text?: string; url?: string; storageKey?: string; alt?: string; items?: Array<{ storageKey: string; alt?: string }> };

function isAdminOrVerwaltung(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

function safeBlocks(raw: unknown): Block[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  let rest = text || "";

  const pushText = (t: string) => {
    if (!t) return;
    parts.push(t);
  };

  while (rest) {
    // link: [label](url)
    const linkMatch = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const codeMatch = rest.match(/`([^`]+)`/);
    const boldItalicMatch = rest.match(/\*\*\*([\s\S]+?)\*\*\*/);
    const boldMatch = rest.match(/\*\*([\s\S]+?)\*\*/);
    const italicMatch = rest.match(/\*([^*]+)\*/);

    const matches = [
      linkMatch ? { kind: "link" as const, idx: linkMatch.index ?? -1, m: linkMatch } : null,
      codeMatch ? { kind: "code" as const, idx: codeMatch.index ?? -1, m: codeMatch } : null,
      boldItalicMatch
        ? { kind: "bolditalic" as const, idx: boldItalicMatch.index ?? -1, m: boldItalicMatch }
        : null,
      boldMatch ? { kind: "bold" as const, idx: boldMatch.index ?? -1, m: boldMatch } : null,
      italicMatch ? { kind: "italic" as const, idx: italicMatch.index ?? -1, m: italicMatch } : null,
    ].filter(Boolean) as Array<{
      kind: "link" | "code" | "bolditalic" | "bold" | "italic";
      idx: number;
      m: RegExpMatchArray;
    }>;

    const next = matches.sort((a, b) => a.idx - b.idx).at(0) ?? null;
    if (!next || next.idx < 0) {
      pushText(rest);
      break;
    }

    pushText(rest.slice(0, next.idx));
    const full = next.m[0] || "";

    if (next.kind === "link") {
      const label = next.m[1] ?? "";
      const url = next.m[2] ?? "";
      parts.push(
        <a
          key={`l-${parts.length}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[color:var(--accent)] underline decoration-[color:color-mix(in_oklab,var(--accent)_40%,transparent)] underline-offset-4"
        >
          {label}
        </a>,
      );
    } else if (next.kind === "code") {
      parts.push(
        <code
          key={`c-${parts.length}`}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[13px]"
        >
          {next.m[1] ?? ""}
        </code>,
      );
    } else if (next.kind === "bolditalic") {
      parts.push(
        <strong key={`bi-${parts.length}`} className="font-semibold">
          <em className="italic">{next.m[1] ?? ""}</em>
        </strong>,
      );
    } else if (next.kind === "bold") {
      parts.push(
        <strong key={`b-${parts.length}`} className="font-semibold">
          {next.m[1] ?? ""}
        </strong>,
      );
    } else if (next.kind === "italic") {
      parts.push(
        <em key={`i-${parts.length}`} className="italic">
          {next.m[1] ?? ""}
        </em>,
      );
    }

    rest = rest.slice(next.idx + full.length);
  }

  return <>{parts}</>;
}

function renderBlocks(blocks: Block[]) {
  const urlFromKey = (key: string) => `/api/blog/assets/raw?key=${encodeURIComponent(key)}`;
  return blocks.map((b) => {
    if (b.type === "divider") return <hr key={b.id} className="my-8 border-[var(--border)]" />;
    if (b.type === "gallery") {
      const items = Array.isArray(b.items) ? b.items : [];
      return (
        <div key={b.id} className="my-10 columns-2 gap-4 md:columns-3">
          {items.map((it, idx) => {
            const key = String(it.storageKey || "").trim();
            if (!key) return null;
            // eslint-disable-next-line @next/next/no-img-element
            return (
              <img
                key={`${b.id}-${idx}`}
                src={urlFromKey(key)}
                alt={it.alt || ""}
                className="mb-4 w-full break-inside-avoid rounded-3xl border border-[var(--border)] shadow-[var(--shadow-soft)]"
              />
            );
          })}
        </div>
      );
    }
    if (b.type === "image") {
      const key = String(b.storageKey || "").trim();
      const src = key ? urlFromKey(key) : String(b.url || "").trim();
      if (!src) return null;
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <figure key={b.id} className="my-8">
          <img
            src={src}
            alt={b.alt || ""}
            className="w-full rounded-3xl border border-[var(--border)] object-cover shadow-[var(--shadow-soft)]"
          />
          {b.alt ? <figcaption className="mt-2 text-xs text-[color:var(--muted)]">{b.alt}</figcaption> : null}
        </figure>
      );
    }

    const text = String(b.text || "").trim();
    if (!text) return <div key={b.id} className="h-4" />;

    if (b.type === "h2")
      return (
        <h2 key={b.id} className="mt-10 text-2xl font-semibold tracking-tight">
          {renderInline(text)}
        </h2>
      );
    if (b.type === "h3")
      return (
        <h3 key={b.id} className="mt-8 text-xl font-semibold tracking-tight">
          {renderInline(text)}
        </h3>
      );
    if (b.type === "quote")
      return (
        <blockquote
          key={b.id}
          className="my-6 rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] px-5 py-4 text-[color:var(--muted)] shadow-[var(--shadow-soft)]"
        >
          <p className="text-base font-semibold leading-relaxed">{renderInline(text)}</p>
        </blockquote>
      );

    return (
      <p
        key={b.id}
        className="mt-4 text-base leading-relaxed text-[color:color-mix(in_oklab,var(--foreground)_92%,transparent)]"
      >
        {renderInline(text)}
      </p>
    );
  });
}

export default async function BlogPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!isAdminOrVerwaltung(viewer.role)) notFound();

  await ensureBlogSchema();

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) notFound();

  const post = await db.query.blogPosts.findFirst({ where: (t, { eq }) => eq(t.id, postId) });
  if (!post) notFound();

  const blocks = safeBlocks((post as any).contentBlocksJson ?? "[]");
  const titleImageKey = String(post.titleImageKey || "").trim();
  const titleImageUrl = titleImageKey ? `/api/blog/assets/raw?key=${encodeURIComponent(titleImageKey)}` : "";

  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-2 shadow-[var(--shadow-soft)]">
              <Image src="/logo/MILODO.png" alt="MILODO" width={1305} height={350} className="h-7 w-auto" priority />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Blog Preview</p>
              <p className="truncate text-sm font-semibold tracking-tight text-[color:var(--muted)]">
                Kategorie: {post.category} · Status: {post.status}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/blog/${post.id}`}
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] hover:bg-[var(--surface-2)]"
            >
              Zurück zum Editor
            </Link>
          </div>
        </div>

        <article className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[var(--shadow)]">
          {titleImageUrl ? (
            <div className="relative h-56 w-full border-b border-[var(--border)] sm:h-72">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={titleImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{post.title || "(ohne Titel)"}</h1>
            {post.excerpt ? (
              <p className="mt-4 text-base font-semibold leading-relaxed text-[color:var(--muted)]">{post.excerpt}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[color:var(--muted)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1">
                {post.publishedAt ? `Veröffentlicht: ${new Date(post.publishedAt).toLocaleString("de-DE")}` : "Nicht veröffentlicht"}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1">Slug: {post.slug || "—"}</span>
            </div>

            <div className="mt-8">{renderBlocks(blocks)}</div>
          </div>
        </article>
      </div>
    </main>
  );
}
