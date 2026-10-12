"use client";

import * as React from "react";
import { plainTextToBlogHtml, sanitizeBlogHtml } from "@/lib/blog-rich-text";

export function RichTextEditor({ value, placeholder, editorRef, onChange, onFocus, onKeyDown, className = "" }: {
  value: string;
  placeholder: string;
  editorRef?: React.RefCallback<HTMLDivElement>;
  onChange: (html: string) => void;
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const clean = sanitizeBlogHtml(value);
    if (el.innerHTML !== clean) el.innerHTML = clean;
  }, [value]);

  function sync() {
    if (ref.current) onChange(sanitizeBlogHtml(ref.current.innerHTML));
  }

  return <div
    ref={(el) => { ref.current = el; editorRef?.(el); }}
    contentEditable suppressContentEditableWarning
    role="textbox" aria-multiline="true" aria-label={placeholder}
    onFocus={(event) => {
      document.execCommand("defaultParagraphSeparator", false, "p");
      onFocus?.(event);
    }} onKeyDown={onKeyDown} onInput={sync} onBlur={sync}
    onPaste={(event) => {
      event.preventDefault();
      const html = event.clipboardData.getData("text/html");
      const clean = html ? sanitizeBlogHtml(html) : plainTextToBlogHtml(event.clipboardData.getData("text/plain"));
      // Native editing keeps the selection and undo history intact.
      document.execCommand("defaultParagraphSeparator", false, "p");
      document.execCommand("insertHTML", false, clean);
      sync();
    }}
    onMouseDownCapture={(event) => event.stopPropagation()}
    onTouchStartCapture={(event) => event.stopPropagation()}
    className={`blog-rich-content rich-markdown-editor min-h-[84px] w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-4 [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-[color:var(--muted)] ${className}`}
    data-placeholder={placeholder} spellCheck
  />;
}
