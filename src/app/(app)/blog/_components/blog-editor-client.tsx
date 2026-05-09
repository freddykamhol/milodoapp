"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type BlockType = "p" | "h2" | "h3" | "quote" | "image" | "gallery" | "divider";
type Block = {
  id: string;
  type: BlockType;
  text?: string;
  url?: string; // legacy (API preview URL)
  storageKey?: string;
  alt?: string;
  items?: Array<{ storageKey: string; alt?: string }>;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function renderInlineMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  let rest = text || "";

  const pushText = (t: string) => {
    if (!t) return;
    parts.push(t);
  };

  while (rest) {
    const linkMatch = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const codeMatch = rest.match(/`([^`]+)`/);
    const boldItalicMatch = rest.match(/\*\*\*([\s\S]+?)\*\*\*/);
    const boldMatch = rest.match(/\*\*([\s\S]+?)\*\*/);
    const italicMatch = rest.match(/\*([^*]+)\*/);

    const matches = [
      linkMatch ? { kind: "link" as const, idx: linkMatch.index ?? -1, m: linkMatch } : null,
      codeMatch ? { kind: "code" as const, idx: codeMatch.index ?? -1, m: codeMatch } : null,
      boldItalicMatch ? { kind: "bolditalic" as const, idx: boldItalicMatch.index ?? -1, m: boldItalicMatch } : null,
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
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[13px]"
        >
          {next.m[1] ?? ""}
        </code>,
      );
    } else if (next.kind === "bolditalic") {
      const inner = next.m[1] ?? "";
      parts.push(
        <strong key={`bi-${parts.length}`} className="font-semibold">
          <em className="italic">{inner}</em>
        </strong>,
      );
    } else if (next.kind === "bold") {
      const inner = next.m[1] ?? "";
      parts.push(
        <strong key={`b-${parts.length}`} className="font-semibold">
          {inner}
        </strong>,
      );
    } else if (next.kind === "italic") {
      const inner = next.m[1] ?? "";
      parts.push(
        <em key={`i-${parts.length}`} className="italic">
          {inner}
        </em>,
      );
    }

    rest = rest.slice(next.idx + full.length);
  }

  return <>{parts}</>;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function markdownToEditableHtml(markdown: string) {
  const src = String(markdown || "");
  if (!src.trim()) return "";
  const lines = src.split(/\n{2,}/g);
  const htmlParagraphs = lines.map((p) => {
    const paragraph = String(p || "");
    if (!paragraph.trim()) return "<p><br></p>";
    return `<p>${inlineMarkdownToHtml(paragraph)}</p>`;
  });
  return htmlParagraphs.join("");
}

function inlineMarkdownToHtml(text: string) {
  let rest = String(text || "");
  let out = "";
  while (rest) {
    const linkMatch = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const codeMatch = rest.match(/`([^`]+)`/);
    const boldItalicMatch = rest.match(/\*\*\*([\s\S]+?)\*\*\*/);
    const boldMatch2 = rest.match(/\*\*([\s\S]+?)\*\*/);
    const italicMatch = rest.match(/\*([^*]+)\*/);

    const matches = [
      linkMatch ? { kind: "link" as const, idx: linkMatch.index ?? -1, m: linkMatch } : null,
      codeMatch ? { kind: "code" as const, idx: codeMatch.index ?? -1, m: codeMatch } : null,
      boldItalicMatch ? { kind: "bolditalic" as const, idx: boldItalicMatch.index ?? -1, m: boldItalicMatch } : null,
      boldMatch2 ? { kind: "bold" as const, idx: boldMatch2.index ?? -1, m: boldMatch2 } : null,
      italicMatch ? { kind: "italic" as const, idx: italicMatch.index ?? -1, m: italicMatch } : null,
    ].filter(Boolean) as Array<{ kind: "link" | "code" | "bolditalic" | "bold" | "italic"; idx: number; m: RegExpMatchArray }>;

    const next = matches.sort((a, b) => a.idx - b.idx).at(0) ?? null;
    if (!next || next.idx < 0) {
      out += escapeHtml(rest);
      break;
    }

    out += escapeHtml(rest.slice(0, next.idx));
    if (next.kind === "link") {
      const label = escapeHtml(next.m[1] ?? "");
      const href = escapeHtml(next.m[2] ?? "");
      out += `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
    } else if (next.kind === "code") {
      const code = escapeHtml(next.m[1] ?? "");
      out += `<code>${code}</code>`;
    } else if (next.kind === "bolditalic") {
      const inner = escapeHtml(next.m[1] ?? "");
      out += `<strong><em>${inner}</em></strong>`;
    } else if (next.kind === "bold") {
      const inner = escapeHtml(next.m[1] ?? "");
      out += `<strong>${inner}</strong>`;
    } else if (next.kind === "italic") {
      const inner = escapeHtml(next.m[1] ?? "");
      out += `<em>${inner}</em>`;
    }
    rest = rest.slice(next.idx + (next.m[0] || "").length);
  }
  return out.replaceAll("\n", "<br>");
}

function htmlToMarkdown(root: HTMLElement) {
  const blocks: string[] = [];
  const children = Array.from(root.childNodes);
  const blockNodes = children.length ? children : [root];

  for (const node of blockNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "P" || el.tagName === "DIV") {
        const md = inlineNodeToMarkdown(el).trimEnd();
        blocks.push(md);
        continue;
      }
    }
    const md = inlineNodeToMarkdown(node).trimEnd();
    blocks.push(md);
  }

  return blocks.map((b) => b.trimEnd()).join("\n\n").replaceAll(/\n{3,}/g, "\n\n");
}

function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replaceAll("\u00A0", " ");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "strong" && el.querySelector(":scope > em")) {
    const em = el.querySelector(":scope > em");
    const inner = em ? Array.from(em.childNodes).map(inlineNodeToMarkdown).join("") : Array.from(el.childNodes).map(inlineNodeToMarkdown).join("");
    return `***${inner}***`;
  }
  if (tag === "strong") return `**${Array.from(el.childNodes).map(inlineNodeToMarkdown).join("")}**`;
  if (tag === "em") return `*${Array.from(el.childNodes).map(inlineNodeToMarkdown).join("")}*`;
  if (tag === "code") return `\`${Array.from(el.childNodes).map(inlineNodeToMarkdown).join("").replaceAll("\n", " ")}\``;
  if (tag === "a") {
    const href = el.getAttribute("href") || "";
    const label = Array.from(el.childNodes).map(inlineNodeToMarkdown).join("");
    return `[${label}](${href})`;
  }
  const inner = Array.from(el.childNodes).map(inlineNodeToMarkdown).join("");
  return inner;
}

function RichMarkdownEditor({
  value,
  placeholder,
  editorRef,
  onChangeMarkdown,
  onFocus,
  onKeyDown,
  className,
}: {
  value: string;
  placeholder: string;
  editorRef?: React.RefCallback<HTMLDivElement>;
  onChangeMarkdown: (next: string) => void;
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  className?: string;
}) {
  const localRef = React.useRef<HTMLDivElement | null>(null);
  const lastHtmlRef = React.useRef<string>("");

  const html = React.useMemo(() => markdownToEditableHtml(value), [value]);

  React.useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (lastHtmlRef.current === html) return;
    el.innerHTML = html;
    lastHtmlRef.current = html;
  }, [html]);

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        editorRef?.(node);
      }}
      contentEditable
      suppressContentEditableWarning
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onInput={() => {
        const el = localRef.current;
        if (!el) return;
        const md = htmlToMarkdown(el);
        onChangeMarkdown(md);
        lastHtmlRef.current = el.innerHTML;
      }}
      onMouseDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
      className={cn(
        "min-h-[84px] w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none",
        "focus:border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border))] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]",
        "[&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-[color:var(--muted)]",
        "whitespace-pre-wrap break-words",
        "[&_code]:rounded-md [&_code]:bg-[var(--surface)] [&_code]:px-2 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:shadow-[inset_0_0_0_1px_var(--border)]",
        className,
      )}
      data-placeholder={placeholder}
      spellCheck
      autoCorrect="on"
      autoCapitalize="sentences"
    />
  );
}

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll(/[^a-z0-9\s-]/g, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-")
    .slice(0, 80);
}

function newId() {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return String(Date.now()) + Math.random().toString(16).slice(2);
  }
}

function blocksToMarkdown(blocks: Block[]) {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "divider") {
      lines.push("---", "");
      continue;
    }
    if (b.type === "image") {
      const key = String(b.storageKey || "").trim();
      if (key) lines.push(`![](/${key})`, "");
      else if (b.url) lines.push(`![](${b.url})`, "");
      continue;
    }
    if (b.type === "gallery") {
      const items = Array.isArray(b.items) ? b.items : [];
      lines.push("<!-- gallery -->");
      for (const it of items) {
        const key = String(it.storageKey || "").trim();
        if (key) lines.push(`![](/${key})`);
      }
      lines.push("<!-- /gallery -->", "");
      continue;
    }
    const raw = String(b.text || "");
    const paragraphs = raw
      .split(/\n{2,}/g)
      .map((p) => p.trim())
      .filter(Boolean);

    if (!paragraphs.length) {
      lines.push("");
      continue;
    }

    for (const p of paragraphs) {
      if (b.type === "h2") lines.push(`## ${p}`, "");
      else if (b.type === "h3") lines.push(`### ${p}`, "");
      else if (b.type === "quote") lines.push(`> ${p.replaceAll("\n", "\n> ")}`, "");
      else lines.push(p, "");
    }
  }
  return lines.join("\n").trim() + "\n";
}

async function safeReadJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await res.text();
    if (!text.trim()) return null;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getStringField(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === "string" ? value : null;
}

function getNumberField(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function Input({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">{label}</span>
      <input
        {...props}
        className={cn(
          "mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none",
          "focus:border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border))] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]",
        )}
      />
      {hint ? <span className="mt-2 block text-xs text-[color:var(--muted)]">{hint}</span> : null}
    </label>
  );
}

function Textarea({
  label,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-tight text-[color:var(--muted)]">{label}</span>
      <textarea
        {...props}
        className={cn(
          "mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none",
          "focus:border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border))] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]",
        )}
      />
      {hint ? <span className="mt-2 block text-xs text-[color:var(--muted)]">{hint}</span> : null}
    </label>
  );
}

function Preview({ blocks }: { blocks: Block[] }) {
  const urlFromKey = (key: string) => `/api/blog/assets/raw?key=${encodeURIComponent(key)}`;
  const renderInline = (text: string) => renderInlineMarkdown(text);

  return (
    <div className="prose max-w-none text-sm">
      {blocks.map((b) => {
        if (b.type === "divider") return <hr key={b.id} className="my-4" />;
        if (b.type === "gallery") {
          const items = Array.isArray(b.items) ? b.items : [];
          return (
            <div key={b.id} className="my-4 columns-2 gap-3 md:columns-3">
	              {items.map((it, idx) => {
	                const key = String(it.storageKey || "").trim();
	                if (!key) return null;
	                return (
	                  // eslint-disable-next-line @next/next/no-img-element
	                  <img
	                    key={`${b.id}-${idx}`}
	                    src={urlFromKey(key)}
	                    alt={it.alt || ""}
                    className="mb-3 w-full break-inside-avoid rounded-2xl border border-[var(--border)]"
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
	          return (
	            // eslint-disable-next-line @next/next/no-img-element
	            <img
	              key={b.id}
	              src={src}
	              alt={b.alt || ""}
	              className="my-4 rounded-2xl border border-[var(--border)]"
	            />
	          );
	        }
	        const raw = String(b.text || "");
	        const paragraphs = raw
	          .split(/\n{2,}/g)
	          .map((p) => p.trim())
	          .filter(Boolean);
	        if (!paragraphs.length) return <div key={b.id} className="h-3" />;

	        if (b.type === "h2") {
	          return (
	            <div key={b.id} className="space-y-2">
	              {paragraphs.map((p, idx) => (
	                <h2 key={idx} className="text-lg font-semibold">
	                  {renderInline(p)}
	                </h2>
	              ))}
	            </div>
	          );
	        }
	        if (b.type === "h3") {
	          return (
	            <div key={b.id} className="space-y-2">
	              {paragraphs.map((p, idx) => (
	                <h3 key={idx} className="text-base font-semibold">
	                  {renderInline(p)}
	                </h3>
	              ))}
	            </div>
	          );
	        }
	        if (b.type === "quote") {
	          return (
	            <div key={b.id} className="space-y-3">
	              {paragraphs.map((p, idx) => (
	                <blockquote key={idx} className="border-l-2 pl-3 text-[color:var(--muted)]">
	                  {renderInline(p)}
	                </blockquote>
	              ))}
	            </div>
	          );
	        }
	        return (
	          <div key={b.id} className="space-y-3">
	            {paragraphs.map((p, idx) => (
	              <p key={idx} className="leading-relaxed">
	                {renderInline(p)}
	              </p>
	            ))}
	          </div>
	        );
	      })}
	    </div>
	  );
	}

type EditorMode = { mode: "new" } | { mode: "edit"; postId: number };

export function BlogEditorClient(props: EditorMode) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const urlFromKey = React.useCallback(
    (key: string) => `/api/blog/assets/raw?key=${encodeURIComponent(key)}`,
    [],
  );

  const [postId, setPostId] = React.useState<number | null>(props.mode === "edit" ? props.postId : null);
  const [status, setStatus] = React.useState<PostStatus>("DRAFT");
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("allgemein");
  const [slug, setSlug] = React.useState("");
  const [slugAuto, setSlugAuto] = React.useState(true);
  const [excerpt, setExcerpt] = React.useState("");
  const [contentBlocks, setContentBlocks] = React.useState<Block[]>([{ id: newId(), type: "p", text: "" }]);
  const [titleImageUrl, setTitleImageUrl] = React.useState<string>("");

  const editorRefs = React.useRef(new Map<string, HTMLDivElement>());
  const [activeBlockId, setActiveBlockId] = React.useState<string | null>(null);
  const [slashFor, setSlashFor] = React.useState<string | null>(null);
  const imageFileRef = React.useRef<HTMLInputElement | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const suppressDragStartForIdRef = React.useRef<string | null>(null);

  const [mediaOpen, setMediaOpen] = React.useState(false);
  const [mediaTab, setMediaTab] = React.useState<"library" | "upload">("library");
  const [mediaMode, setMediaMode] = React.useState<"inline" | "gallery" | "title">("inline");
  const [mediaRows, setMediaRows] = React.useState<Array<{ storageKey: string; url: string; fileName: string }>>([]);
  const [mediaSelected, setMediaSelected] = React.useState<string[]>([]);
  const [mediaBusy, setMediaBusy] = React.useState(false);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [editGalleryId, setEditGalleryId] = React.useState<string | null>(null);
  const [replaceImageId, setReplaceImageId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (props.mode !== "edit") return;
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await fetch(`/api/blog/posts/${props.postId}`);
      const json = await safeReadJson(res);
      const ok = Boolean(json && json.ok === true);
      const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "load_failed";
      if (!res.ok || !ok) throw new Error(errorMsg);
      if (!json) throw new Error("load_failed");
      if (cancelled) return;
      const row = asRecord(json.row);
      if (!row) throw new Error("load_failed");
      const rowId = getNumberField(row, "id");
      const rowStatus = getStringField(row, "status");
      if (!rowId || !rowStatus) throw new Error("load_failed");
      setPostId(rowId);
      setStatus(rowStatus as PostStatus);
      const rowTitle = getStringField(row, "title") ?? "";
      setTitle(rowTitle);
      setCategory(getStringField(row, "category") ?? "allgemein");
      const loadedSlug = getStringField(row, "slug") ?? "";
      const loadedTitle = rowTitle;
      setSlug(loadedSlug);
      setSlugAuto(Boolean(rowStatus !== "PUBLISHED" && (!loadedSlug.trim() || loadedSlug === slugify(loadedTitle))));
      setExcerpt(getStringField(row, "excerpt") ?? "");

      const rawBlocks = getStringField(row, "contentBlocksJson") ?? "";
      try {
        const parsed = JSON.parse(rawBlocks || "[]");
        if (Array.isArray(parsed) && parsed.length) setContentBlocks(parsed);
        else setContentBlocks([{ id: newId(), type: "p", text: getStringField(row, "contentMd") ?? "" }]);
      } catch {
        setContentBlocks([{ id: newId(), type: "p", text: getStringField(row, "contentMd") ?? "" }]);
      }

      const titleImageKey = getStringField(row, "titleImageKey") ?? "";
      setTitleImageUrl(titleImageKey ? `/api/blog/assets/raw?key=${encodeURIComponent(titleImageKey)}` : "");
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "load_failed");
    });
    return () => {
      cancelled = true;
    };
  }, [props]);

  async function createIfNeeded() {
    if (postId) return postId;
    const res = await fetch("/api/blog/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title || "Neuer Beitrag", category }),
    });
    const json = await safeReadJson(res);
    const ok = Boolean(json && json.ok === true);
    const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "create_failed";
    if (!res.ok || !ok) throw new Error(errorMsg);
    const id = json ? getNumberField(json, "id") : null;
    if (!id) throw new Error("create_failed");
    setPostId(id);
    router.replace(`/blog/${id}`);
    return id;
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const id = await createIfNeeded();
      const contentMd = blocksToMarkdown(contentBlocks);
      const res = await fetch(`/api/blog/posts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          slug,
          excerpt,
          status,
          contentMd,
          contentBlocksJson: JSON.stringify(contentBlocks),
        }),
      });
      const json = await safeReadJson(res);
      const ok = Boolean(json && json.ok === true);
      const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "save_failed";
      if (!res.ok || !ok) throw new Error(errorMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setError(null);
    setBusy(true);
    try {
      const id = await createIfNeeded();
      await save();
      const res = await fetch(`/api/blog/posts/${id}/publish`, { method: "POST" });
      const json = await safeReadJson(res);
      const ok = Boolean(json && json.ok === true);
      const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "publish_failed";
      if (!res.ok || !ok) throw new Error(errorMsg);
      setStatus("PUBLISHED");
      setSlugAuto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "publish_failed");
    } finally {
      setBusy(false);
    }
  }

  async function openPreviewPage() {
    setError(null);
    setBusy(true);
    try {
      const id = await createIfNeeded();
      await save();
      window.open(`/blog/${id}/preview`, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "preview_failed");
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: "TITLE" | "INLINE", files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const id = await createIfNeeded();
      const list = Array.from(files);
      const filesToUpload = kind === "TITLE" ? list.slice(0, 1) : list;

      let lastInsertedAfterId = activeBlockId || contentBlocks.at(-1)?.id || null;

      if (kind === "TITLE") {
        const file = filesToUpload[0];
        if (!file) return;
        const form = new FormData();
        form.set("postId", String(id));
        form.set("kind", "TITLE");
        form.set("file", file, file.name);
        const res = await fetch("/api/blog/assets/upload", { method: "POST", body: form });
        const json = await safeReadJson(res);
        const ok = Boolean(json && json.ok === true);
        const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "upload_failed";
        if (!res.ok || !ok) throw new Error(errorMsg);
        const url = json ? getStringField(json, "url") : null;
        setTitleImageUrl(url ?? "");
        return;
      }

      const form = new FormData();
      for (const file of filesToUpload) {
        if (!file) continue;
        form.append("file", file, file.name);
      }
      const res = await fetch("/api/blog/media/upload", { method: "POST", body: form });
      const json = await safeReadJson(res);
      const ok = Boolean(json && json.ok === true);
      const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "upload_failed";
      if (!res.ok || !ok) throw new Error(errorMsg);
      const rowsRaw = json ? (json["rows"] as unknown) : null;
      const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

      for (const r of rows) {
        const key = String(r.storageKey || "").trim();
        if (!key) continue;
        const imageBlock: Block = { id: newId(), type: "image", storageKey: key, alt: "" };
        const spacer: Block = { id: newId(), type: "p", text: "" };

        setContentBlocks((prev) => {
          const afterId = lastInsertedAfterId || prev.at(-1)?.id || null;
          if (!afterId) return [imageBlock, spacer, ...prev];
          const idx = prev.findIndex((b) => b.id === afterId);
          if (idx < 0) return [...prev, imageBlock, spacer];
          return [...prev.slice(0, idx + 1), imageBlock, spacer, ...prev.slice(idx + 1)];
        });

        lastInsertedAfterId = spacer.id;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload_failed");
    } finally {
      setBusy(false);
    }
  }

  async function replaceImageFromUpload(blockId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      await createIfNeeded();
      const file = files[0];
      if (!file) return;
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch("/api/blog/media/upload", { method: "POST", body: form });
      const json = await safeReadJson(res);
      const ok = Boolean(json && json.ok === true);
      const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "upload_failed";
      if (!res.ok || !ok) throw new Error(errorMsg);
      const rowsRaw = json ? (json["rows"] as unknown) : null;
      const first = Array.isArray(rowsRaw) ? rowsRaw.at(0) : null;
      const firstRow = asRecord(first);
      const key = firstRow ? (getStringField(firstRow, "storageKey") ?? "") : "";
      if (!key) throw new Error("upload_failed");
      updateBlock(blockId, { storageKey: key, url: undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload_failed");
    } finally {
      setBusy(false);
    }
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    setContentBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertBlock(afterId: string | null, block: Block) {
    setContentBlocks((prev) => {
      if (!afterId) return [block, ...prev];
      const idx = prev.findIndex((b) => b.id === afterId);
      if (idx < 0) return [...prev, block];
      return [...prev.slice(0, idx + 1), block, ...prev.slice(idx + 1)];
    });
  }

  function removeBlock(id: string) {
    setContentBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      return next.length ? next : [{ id: newId(), type: "p", text: "" }];
    });
  }

  function syncActiveEditorToMarkdown() {
    if (!activeBlockId) return;
    const el = editorRefs.current.get(activeBlockId) ?? null;
    if (!el) return;
    updateBlock(activeBlockId, { text: htmlToMarkdown(el) });
  }

  function applyInlineWrap(prefix: string, suffix: string = prefix) {
    if (!activeBlockId) return;
    const el = editorRefs.current.get(activeBlockId) ?? null;
    if (!el) return;
    el.focus();

    if (prefix === "**") {
      document.execCommand("bold");
      syncActiveEditorToMarkdown();
      return;
    }
    if (prefix === "*") {
      document.execCommand("italic");
      syncActiveEditorToMarkdown();
      return;
    }
    if (prefix === "`") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return;
      if (range.collapsed) return;

      const common =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;
      const codeEl = common?.closest("code") ?? null;

      // toggle off when selection is entirely inside one <code>
      if (codeEl && el.contains(codeEl)) {
        const codeRange = document.createRange();
        codeRange.selectNodeContents(codeEl);
        const startsAfterOrAt = range.compareBoundaryPoints(Range.START_TO_START, codeRange) >= 0;
        const endsBeforeOrAt = range.compareBoundaryPoints(Range.END_TO_END, codeRange) <= 0;
        if (startsAfterOrAt && endsBeforeOrAt) {
          try {
            const parent = codeEl.parentNode;
            if (!parent) return;
            while (codeEl.firstChild) parent.insertBefore(codeEl.firstChild, codeEl);
            parent.removeChild(codeEl);
          } catch {
            // ignore
          }
          syncActiveEditorToMarkdown();
          return;
        }
      }

      const wrapper = document.createElement("code");
      try {
        wrapper.appendChild(range.extractContents());
        range.insertNode(wrapper);
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(wrapper);
        r.collapse(false);
        sel.addRange(r);
      } catch {
        // ignore
      }
      syncActiveEditorToMarkdown();
      return;
    }
    if (prefix === "[" && suffix.startsWith("](")) {
      const url = suffix.slice(2, -1);
      const sel = window.getSelection();
      const node =
        sel?.rangeCount ? (sel.getRangeAt(0).commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (sel.getRangeAt(0).commonAncestorContainer as Element)
          : sel.getRangeAt(0).commonAncestorContainer.parentElement) : null;
      const anchor = node?.closest("a") ?? null;
      if (anchor && el.contains(anchor)) document.execCommand("unlink");
      else document.execCommand("createLink", false, url);
      syncActiveEditorToMarkdown();
      return;
    }

    // fallback: no-op (kept for legacy calls)
    void suffix;
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setContentBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item!);
      return copy;
    });
  }

  function reorder(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    setContentBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === draggedId);
      const to = prev.findIndex((b) => b.id === targetId);
      if (from < 0 || to < 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item!);
      return copy;
    });
  }

  const slashOptions: Array<{ key: string; label: string; apply: (id: string) => void }> = [
    { key: "p", label: "Text", apply: (id) => updateBlock(id, { type: "p", text: "" }) },
    { key: "h2", label: "Überschrift", apply: (id) => updateBlock(id, { type: "h2" }) },
    { key: "h3", label: "Unterüberschrift", apply: (id) => updateBlock(id, { type: "h3" }) },
    { key: "quote", label: "Zitat", apply: (id) => updateBlock(id, { type: "quote" }) },
    {
      key: "img",
      label: "Bild",
      apply: () => {
        setEditGalleryId(null);
        setReplaceImageId(null);
        setMediaMode("inline");
        setMediaTab("library");
        setMediaSelected([]);
        setMediaError(null);
        setMediaOpen(true);
        void loadMedia();
      },
    },
    {
      key: "gal",
      label: "Galerie (Masonry)",
      apply: () => {
        setEditGalleryId(null);
        setReplaceImageId(null);
        setMediaMode("gallery");
        setMediaTab("library");
        setMediaSelected([]);
        setMediaError(null);
        setMediaOpen(true);
        void loadMedia();
      },
    },
    { key: "div", label: "Trenner", apply: (id) => updateBlock(id, { type: "divider", text: "" }) },
  ];

  async function loadMedia() {
    setMediaBusy(true);
    setMediaError(null);
    try {
      const res = await fetch("/api/blog/media?limit=120");
      const json = await safeReadJson(res);
      const ok = Boolean(json && json.ok === true);
      const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "media_load_failed";
      if (!res.ok || !ok) throw new Error(errorMsg);
      const rowsRaw = json ? (json["rows"] as unknown) : null;
      setMediaRows(Array.isArray(rowsRaw) ? (rowsRaw as Array<{ storageKey: string; url: string; fileName: string }>) : []);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "media_load_failed");
    } finally {
      setMediaBusy(false);
    }
  }

  function closeMedia() {
    setMediaOpen(false);
    setEditGalleryId(null);
    setReplaceImageId(null);
  }

  async function insertSelectedMedia() {
    const keys = mediaSelected.slice();
    if (!keys.length) return;

    const insertAfterId = activeBlockId || contentBlocks.at(-1)?.id || null;

    if (mediaMode === "title") {
      setError(null);
      setBusy(true);
      try {
        const id = await createIfNeeded();
        const res = await fetch(`/api/blog/posts/${id}/title-image`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storageKey: keys[0] }),
        });
        const json = await safeReadJson(res);
        const ok = Boolean(json && json.ok === true);
        const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "title_image_failed";
        if (!res.ok || !ok) throw new Error(errorMsg);
        const url = json ? getStringField(json, "url") : null;
        setTitleImageUrl(url ?? "");
        closeMedia();
      } catch (e) {
        setError(e instanceof Error ? e.message : "title_image_failed");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mediaMode === "gallery") {
      const items = keys.map((k) => ({ storageKey: k, alt: "" }));
      if (editGalleryId) {
        updateBlock(editGalleryId, { type: "gallery", items });
        closeMedia();
        return;
      }
      const block: Block = { id: newId(), type: "gallery", items };
      insertBlock(insertAfterId, block);
      insertBlock(block.id, { id: newId(), type: "p", text: "" });
      closeMedia();
      return;
    }

    if (replaceImageId) {
      updateBlock(replaceImageId, { type: "image", storageKey: keys[0]!, url: undefined });
      closeMedia();
      return;
    }

    let after = insertAfterId;
    for (const key of keys) {
      const img: Block = { id: newId(), type: "image", storageKey: key, alt: "" };
      const spacer: Block = { id: newId(), type: "p", text: "" };
      insertBlock(after, img);
      insertBlock(img.id, spacer);
      after = spacer.id;
    }
    closeMedia();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-3xl border border-[color:color-mix(in_oklab,var(--danger)_30%,var(--border))] bg-[color:color-mix(in_oklab,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-[color:var(--danger)] shadow-[var(--shadow-soft)]">
          <span className="font-semibold">Fehler:</span> {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">Editor</p>
          <p className="mt-1 truncate text-sm font-semibold tracking-tight">
            {postId ? `Beitrag #${postId}` : "Noch nicht gespeichert"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openPreviewPage()}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] hover:bg-[var(--surface-2)]"
          >
            Preview öffnen
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className={cn(
              "inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] hover:bg-[var(--surface-2)]",
              busy ? "opacity-60" : "",
            )}
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy}
            className={cn(
              "inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:brightness-[1.02]",
              busy ? "opacity-60" : "",
            )}
          >
            Veröffentlichen (FTP Export)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Titel"
              value={title}
              onChange={(e) => {
                const next = e.target.value;
                setTitle(next);
                if (status !== "PUBLISHED" && slugAuto) setSlug(slugify(next));
              }}
              placeholder="Titel eingeben…"
            />
            <Input
              label="Kategorie"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="z.B. rettungsdienst"
              hint="Wird als Ordner auf dem FTP verwendet: /blog/(kategorie)/..."
            />
            <Input
              label="Slug"
              value={slug}
              onChange={(e) => {
                setSlugAuto(false);
                setSlug(e.target.value);
              }}
              placeholder="url-slug"
              hint={
                status === "PUBLISHED"
                  ? "Wird in post.json gespeichert."
                  : slugAuto
                    ? "Auto (live) aus Titel – tippe hier, um manuell zu überschreiben."
                    : "Manuell – leer machen für Auto."
              }
              onBlur={() => {
                if (status === "PUBLISHED") return;
                if (!slug.trim()) setSlugAuto(true);
              }}
            />
            <Input label="Status" value={status} readOnly />
          </div>

          <div className="mt-4">
            <Textarea
              label="Kurzbeschreibung"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              placeholder="Kurztext für Startseite…"
            />
          </div>

          <div className="mt-4 rounded-3xl border border-[var(--border)] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">Titelbild</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">Wird im Export als `titleImageKey` referenziert.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMediaMode("title");
                    setMediaTab("library");
                    setMediaError(null);
                    setEditGalleryId(null);
                    setReplaceImageId(null);
                    setMediaSelected([]);
                    setMediaOpen(true);
                    void loadMedia();
                  }}
                  className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                >
                  Aus Mediathek
                </button>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:brightness-[1.02]">
                  Hochladen
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      void upload("TITLE", e.currentTarget.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            {titleImageUrl ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={titleImageUrl} alt="Titelbild" className="h-44 w-full object-cover" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-sm font-semibold tracking-tight">Blocks & Slash</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Tippe am Block-Anfang <span className="font-semibold">/</span> für: Text, Überschrift, Quote, Bild, Trenner.
          </p>
	          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-xs text-[color:var(--muted)]">
	            Inline-Formatierung: Buttons erscheinen im aktiven Block (Fett, Kursiv, Code, Link).
	          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold tracking-tight">Inhalt</p>
          <p className="text-xs text-[color:var(--muted)]">Export: `content.md` (aus Blocks generiert)</p>
        </div>

        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            void upload("INLINE", e.target.files);
            if (e.currentTarget) e.currentTarget.value = "";
          }}
        />

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
	          <div>
	            <div className="space-y-3">

              {contentBlocks.map((b) => {
                const isActive = activeBlockId === b.id;
                const headerLabel =
                  b.type === "h2"
                    ? "Überschrift"
                    : b.type === "h3"
                      ? "Unterüberschrift"
                      : b.type === "quote"
                        ? "Zitat"
                        : b.type === "image"
                          ? "Bild"
                          : b.type === "gallery"
                            ? "Galerie"
                          : b.type === "divider"
                            ? "Trenner"
                            : "Text";

		                return (
		                  <div
		                    key={b.id}
		                    draggable
		                    onMouseDownCapture={(e) => {
		                      const target = e.target as HTMLElement | null;
		                      if (!target) return;
		                      if (target.closest("textarea")) suppressDragStartForIdRef.current = b.id;
		                    }}
		                    onTouchStartCapture={(e) => {
		                      const target = e.target as HTMLElement | null;
		                      if (!target) return;
		                      if (target.closest("textarea")) suppressDragStartForIdRef.current = b.id;
		                    }}
		                    onDragStart={(e) => {
		                      const target = e.target as HTMLElement | null;
		                      if (suppressDragStartForIdRef.current === b.id) {
		                        suppressDragStartForIdRef.current = null;
		                        e.preventDefault();
		                        return;
		                      }
		                      if (target?.closest("textarea, input, select, option, button, a")) {
		                        e.preventDefault();
		                        return;
		                      }
		                      setDragId(b.id);
		                      try {
		                        e.dataTransfer.setData("text/plain", b.id);
		                        e.dataTransfer.effectAllowed = "move";
		                      } catch {
		                        // ignore
		                      }
		                    }}
		                    onDragOver={(e) => {
		                      e.preventDefault();
		                      setDragOverId(b.id);
		                      try {
                        e.dataTransfer.dropEffect = "move";
                      } catch {
                        // ignore
                      }
                    }}
		                    onDrop={(e) => {
		                      e.preventDefault();
		                      suppressDragStartForIdRef.current = null;
		                      const dragged =
		                        dragId ||
		                        (() => {
                          try {
                            return e.dataTransfer.getData("text/plain");
                          } catch {
                            return "";
                          }
                        })();
		                      if (dragged) reorder(dragged, b.id);
		                      setDragId(null);
		                      setDragOverId(null);
		                    }}
		                    onDragEnd={() => {
		                      suppressDragStartForIdRef.current = null;
		                      setDragId(null);
		                      setDragOverId(null);
		                    }}
                    className={cn(
                      "rounded-3xl border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-soft)]",
                      isActive ? "ring-2 ring-[color:color-mix(in_oklab,var(--accent)_30%,transparent)]" : "",
                      dragOverId === b.id
                        ? "outline outline-2 outline-[color:color-mix(in_oklab,var(--accent)_35%,transparent)]"
                        : "",
                    )}
	                  >
	                    <div className="flex items-center justify-between gap-2 px-1 pb-2">
	                      <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)]">{headerLabel}</p>
                      <button
                        type="button"
                        onClick={() => removeBlock(b.id)}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold hover:bg-[var(--surface-2)]"
                      >
                        Löschen
                      </button>
		                    </div>
		                    <div className="mb-2 flex items-center justify-end gap-2 px-1">
		                      <div className="flex items-center gap-1">
		                        <button
		                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => moveBlock(b.id, -1)}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold hover:bg-[var(--surface-2)]"
                          aria-label="Block nach oben"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => moveBlock(b.id, 1)}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold hover:bg-[var(--surface-2)]"
                          aria-label="Block nach unten"
                        >
                          ↓
                        </button>
                      </div>
                    </div>

                    {b.type === "divider" ? (
                      <div className="px-1 py-2">
                        <hr className="border-[var(--border)]" />
                      </div>
                    ) : b.type === "gallery" ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                          {Array.isArray(b.items) && b.items.length ? (
                            <div className="columns-2 gap-2 md:columns-3">
	                              {b.items.slice(0, 12).map((it, idx) => {
	                                const key = String(it.storageKey || "").trim();
	                                if (!key) return null;
	                                return (
	                                  // eslint-disable-next-line @next/next/no-img-element
	                                  <img
	                                    key={`${b.id}-${idx}`}
	                                    src={urlFromKey(key)}
	                                    alt={it.alt || ""}
                                    className="mb-2 w-full break-inside-avoid rounded-xl border border-[var(--border)]"
                                  />
                                );
                              })}
                            </div>
                          ) : (
                            <div className="px-4 py-6 text-sm text-[color:var(--muted)]">Keine Bilder ausgewählt.</div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
	                        onClick={() => {
	                          setMediaMode("gallery");
	                          setMediaTab("library");
	                          setMediaError(null);
	                          setEditGalleryId(b.id);
	                          setReplaceImageId(null);
	                          setMediaSelected((Array.isArray(b.items) ? b.items : []).map((it) => it.storageKey));
	                          setMediaOpen(true);
	                          void loadMedia();
	                        }}
                            className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                          >
                            Galerie bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditGalleryId(b.id);
                              updateBlock(b.id, { items: [] });
                            }}
                            className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                          >
                            Leeren
                          </button>
                        </div>
                      </div>
                    ) : b.type === "image" ? (
                      <div className="space-y-2">
                        {String(b.storageKey || "").trim() || b.url ? (
                          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                String(b.storageKey || "").trim()
                                  ? urlFromKey(String(b.storageKey || "").trim())
                                  : String(b.url || "")
                              }
                              alt={b.alt || ""}
                              className="h-56 w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[color:var(--muted)]">
                            Kein Bild gesetzt.
                          </div>
                        )}
                        <Input
                          label="Alt-Text"
                          value={b.alt || ""}
                          onChange={(e) => updateBlock(b.id, { alt: e.target.value })}
                          placeholder="Optional…"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMediaMode("inline");
                              setMediaTab("library");
                              setMediaError(null);
                              setEditGalleryId(null);
                              setReplaceImageId(b.id);
                              setMediaSelected([]);
                              setMediaOpen(true);
                              void loadMedia();
                            }}
                            className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                          >
                            Aus Mediathek
                          </button>
                          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]">
                            Upload ersetzen
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                void replaceImageFromUpload(b.id, e.target.files);
                                if (e.currentTarget) e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
	                    ) : (
	                      <div className="relative">
	                        {isActive && (b.type === "p" || b.type === "h2" || b.type === "h3" || b.type === "quote") ? (
	                          <div className="mb-2 flex flex-wrap gap-2">
	                            <button
	                              type="button"
	                              onMouseDown={(e) => e.preventDefault()}
	                              onClick={() => applyInlineWrap("**")}
	                              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
	                            >
	                              Fett
	                            </button>
	                            <button
	                              type="button"
	                              onMouseDown={(e) => e.preventDefault()}
	                              onClick={() => applyInlineWrap("*")}
	                              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
	                            >
	                              Kursiv
	                            </button>
	                            <button
	                              type="button"
	                              onMouseDown={(e) => e.preventDefault()}
	                              onClick={() => applyInlineWrap("`")}
	                              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
	                            >
	                              Code
	                            </button>
	                            <button
	                              type="button"
	                              onMouseDown={(e) => e.preventDefault()}
	                              onClick={() => {
	                                const url = window.prompt("Link URL");
	                                if (!url) return;
	                                applyInlineWrap("[", `](${url})`);
	                              }}
	                              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
	                            >
	                              Link
	                            </button>
	                          </div>
	                        ) : null}
		                        <RichMarkdownEditor
		                          editorRef={(node) => {
		                            if (!node) {
		                              editorRefs.current.delete(b.id);
		                              return;
		                            }
		                            editorRefs.current.set(b.id, node);
		                          }}
		                          value={String(b.text || "")}
		                          onChangeMarkdown={(next) => {
		                            if (next === "/") setSlashFor(b.id);
		                            if (slashFor === b.id && String(next || "").trim() !== "/") setSlashFor(null);
		                            updateBlock(b.id, { text: next });
		                          }}
		                          onFocus={() => {
		                            setActiveBlockId(b.id);
		                          }}
		                          onKeyDown={(e) => {
		                            if (e.key === "Escape") setSlashFor(null);
		                            if (e.key === "Enter") {
		                              e.preventDefault();
		                              if (e.shiftKey) document.execCommand("insertLineBreak");
		                              else document.execCommand("insertParagraph");
		                              requestAnimationFrame(() => {
		                                const el = editorRefs.current.get(b.id);
		                                if (el) updateBlock(b.id, { text: htmlToMarkdown(el) });
		                              });
		                            }
		                          }}
		                          className={cn(
		                            b.type === "quote" ? "border-l-4 border-l-[color:var(--accent)]" : "",
		                            "[&_p]:m-0 [&_div]:m-0 [&_p:not(:last-child)]:mb-4 [&_div:not(:last-child)]:mb-4",
		                          )}
		                          placeholder={
		                            b.type === "h2"
		                              ? "Überschrift…"
		                              : b.type === "h3"
		                                ? "Unterüberschrift…"
		                                : b.type === "quote"
		                                  ? "Zitat…"
		                                  : "Text… (Tippe / für Blocks)"
		                          }
		                        />

                        {slashFor === b.id ? (
                          <div className="absolute left-2 top-2 z-10 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow)]">
                            {slashOptions.map((opt) => (
                              <button
                                key={opt.key}
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-2)]"
                                onClick={() => {
                                  setSlashFor(null);
                                  updateBlock(b.id, { text: String(b.text || "").replace(/^\/\s*/, "") });
                                  opt.apply(b.id);
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => insertBlock(contentBlocks.at(-1)?.id ?? null, { id: newId(), type: "p", text: "" })}
                className="inline-flex items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[color:var(--muted)] hover:bg-[var(--surface-2)]"
              >
                + Block hinzufügen
              </button>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="min-h-[440px] w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
              <Preview blocks={contentBlocks} />
            </div>
          </div>
        </div>
      </div>

      {mediaOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-label="Medien"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeMedia();
              }}
            >
              <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Medien</p>
                    <p className="mt-1 text-xs text-[color:var(--muted)]">
                      {mediaMode === "gallery"
                        ? "Mehrere Bilder auswählen für eine Masonry Galerie."
                        : "Ein oder mehrere Bilder auswählen zum Einfügen."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeMedia()}
                    className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)]"
                  >
                    Schließen
                  </button>
                </div>

                <div className="flex flex-col gap-0 sm:flex-row">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-white px-5 py-3 sm:w-64 sm:flex-col sm:items-stretch sm:justify-start sm:border-b-0 sm:border-r">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMediaTab("library")}
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm font-semibold",
                          mediaTab === "library"
                            ? "bg-[color:color-mix(in_oklab,var(--accent)_16%,transparent)] text-[color:var(--accent)]"
                            : "text-[color:var(--muted)] hover:bg-[var(--surface-2)]",
                        )}
                      >
                        Mediathek
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaTab("upload")}
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm font-semibold",
                          mediaTab === "upload"
                            ? "bg-[color:color-mix(in_oklab,var(--accent)_16%,transparent)] text-[color:var(--accent)]"
                            : "text-[color:var(--muted)] hover:bg-[var(--surface-2)]",
                        )}
                      >
                        Upload
                      </button>
                    </div>

                    <div className="hidden sm:block">
                      <button
                        type="button"
                        onClick={() => void loadMedia()}
                        className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                      >
                        Aktualisieren
                      </button>
                      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[color:var(--muted)]">
                        Ausgewählt: <span className="font-semibold">{mediaSelected.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-[420px] flex-1 bg-white p-5">
                    {mediaError ? (
                      <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--danger)_30%,var(--border))] bg-[color:color-mix(in_oklab,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-[color:var(--danger)]">
                        <span className="font-semibold">Fehler:</span> {mediaError}
                      </div>
                    ) : null}

                    {mediaTab === "upload" ? (
                      <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
                        <p className="text-sm font-semibold">Bilder hochladen</p>
                        <p className="mt-1 text-xs text-[color:var(--muted)]">
                          Dateien landen global unter <span className="font-semibold">`blog/uploads`</span> und sind in allen Beiträgen nutzbar.
                        </p>
                        <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-2xl bg-[color:var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:brightness-[1.02]">
                          Dateien auswählen
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={async (e) => {
                              const files = e.currentTarget.files;
                              if (!files || files.length === 0) return;
                              setMediaBusy(true);
                              setMediaError(null);
                              try {
                                const form = new FormData();
                                for (const f of Array.from(files)) form.append("file", f, f.name);
                                const res = await fetch("/api/blog/media/upload", { method: "POST", body: form });
                                const json = await safeReadJson(res);
                                const ok = Boolean(json && json.ok === true);
                                const errorMsg = json && typeof json.error === "string" && json.error ? json.error : "upload_failed";
                                if (!res.ok || !ok) throw new Error(errorMsg);
                                const rowsRaw = json ? (json["rows"] as unknown) : null;
                                const newRows = Array.isArray(rowsRaw) ? rowsRaw : [];
                                setMediaRows((prev) => [...newRows, ...prev]);
                                setMediaTab("library");
                              } catch (err) {
                                setMediaError(err instanceof Error ? err.message : "upload_failed");
                              } finally {
                                setMediaBusy(false);
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                        </label>
                        {mediaBusy ? <p className="mt-3 text-xs text-[color:var(--muted)]">Upload läuft…</p> : null}
                      </div>
                    ) : (
                      <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">Mediathek</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setMediaSelected([])}
                              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                            >
                              Auswahl leeren
                            </button>
                            <button
                              type="button"
                              onClick={() => void insertSelectedMedia()}
                              disabled={!mediaSelected.length}
                              className={cn(
                                "rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)]",
                                !mediaSelected.length ? "opacity-60" : "hover:brightness-[1.02]",
                              )}
                            >
                              {mediaMode === "gallery" ? "Galerie einfügen" : mediaMode === "title" ? "Als Titelbild" : "Einfügen"}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                          {mediaRows.map((m) => {
                            const selected = mediaSelected.includes(m.storageKey);
                            return (
                              <button
                                key={m.storageKey}
                                type="button"
                                onClick={() => {
                                  if (mediaMode === "title") return setMediaSelected([m.storageKey]);
                                  return setMediaSelected((prev) =>
                                    prev.includes(m.storageKey)
                                      ? prev.filter((k) => k !== m.storageKey)
                                      : [...prev, m.storageKey],
                                  );
                                }}
                                className={cn(
                                  "group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left shadow-[var(--shadow-soft)]",
                                  selected
                                    ? "ring-2 ring-[color:color-mix(in_oklab,var(--accent)_35%,transparent)]"
                                    : "hover:ring-2 hover:ring-[color:color-mix(in_oklab,var(--accent)_18%,transparent)]",
                                )}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={m.url} alt={m.fileName} className="h-28 w-full object-cover" />
                                <div className="px-2 py-2">
                                  <p className="truncate text-[11px] font-semibold text-[color:var(--muted)]">{m.fileName}</p>
                                </div>
                                {selected ? (
                                  <span className="absolute right-2 top-2 rounded-full bg-[color:var(--accent)] px-2 py-1 text-[10px] font-semibold text-white">
                                    ✓
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>

                        {!mediaRows.length && !mediaBusy ? (
                          <div className="mt-8 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center text-sm text-[color:var(--muted)]">
                            Noch keine Medien. Nutze „Upload“.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
