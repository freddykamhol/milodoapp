"use client";

import * as React from "react";
import { createPortal } from "react-dom";

type Choice = { value: string; label: string; disabled: boolean; group?: string };
type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { ref?: React.Ref<HTMLSelectElement>;searchable?:boolean };

function textOf(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? textOf(child.props.children) : String(child ?? "")).join("");
}

function choicesOf(children: React.ReactNode, group?: string, groupDisabled = false): Choice[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean; label?: string }>(child)) return [];
    if (child.type === "option") return [{ value: String(child.props.value ?? textOf(child.props.children)), label: textOf(child.props.children), disabled: groupDisabled || Boolean(child.props.disabled), group }];
    return choicesOf(child.props.children, child.type === "optgroup" ? child.props.label : group, groupDisabled || Boolean(child.props.disabled));
  });
}

/** Custom listbox; the clipped select only preserves FormData, validation and change events. */
export function AppSelect({ children, className = "", style, id, value, defaultValue, onChange, disabled, required, ref, searchable, ...props }: Props) {
  const nativeRef = React.useRef<HTMLSelectElement>(null);
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const generatedId = React.useId();
  const listId = `${generatedId}-options`;
  const options = React.useMemo(() => choicesOf(children), [children]);
  const [internal, setInternal] = React.useState(String(defaultValue ?? options[0]?.value ?? ""));
  const selected = String(value ?? internal);
  const [open, setOpen] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const filtered = options.filter(option => option.label.toLocaleLowerCase("de").includes(query.toLocaleLowerCase("de")));
  const label = options.find(option => option.value === selected)?.label ?? "Bitte ausw\u00E4hlen";

  const place = React.useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const offsetTop = viewport?.offsetTop ?? 0;
    const offsetLeft = viewport?.offsetLeft ?? 0;
    const width = Math.min(Math.max(rect.width, 180), viewportWidth - 24);
    const below = viewportHeight + offsetTop - rect.bottom - 16;
    const above = rect.top - offsetTop - 16;
    const maxHeight = Math.max(0, Math.min(320, Math.max(below, above), viewportHeight - 24));
    const height = Math.min(panelRef.current?.scrollHeight ?? 280, maxHeight);
    const top = below >= height || below >= above ? rect.bottom + 6 : rect.top - height - 6;
    setPosition({ left: Math.max(offsetLeft + 12, Math.min(rect.left, offsetLeft + viewportWidth - width - 12)), top: Math.max(offsetTop + 12, Math.min(top, offsetTop + viewportHeight - height - 12)), width, maxHeight });
  }, []);

  React.useLayoutEffect(() => { if (open) place(); }, [open, place, query]);
  React.useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); window.visualViewport?.removeEventListener("resize", place); };
  }, [open, place]);
  React.useEffect(() => { panelRef.current?.querySelector<HTMLElement>(`[data-active="true"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  function show() {
    if (disabled) return;
    setQuery(""); setActive(Math.max(0, options.findIndex(option => option.value === selected))); setOpen(true);
  }
  function choose(option: Choice) {
    if (option.disabled) return;
    setInternal(option.value); setInvalid(false); setOpen(false);
    if (nativeRef.current) { nativeRef.current.value = option.value; nativeRef.current.dispatchEvent(new Event("change", { bubbles: true })); }
    triggerRef.current?.focus();
  }
  function keyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); if (!open) { show(); return; }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      let next = active;
      for (let i = 0; i < filtered.length; i++) { next = (next + direction + filtered.length) % filtered.length; if (!filtered[next]?.disabled) break; }
      setActive(next); return;
    }
    if (open && (event.key === "Home" || event.key === "End")) { event.preventDefault(); setActive(event.key === "Home" ? 0 : filtered.length - 1); return; }
    if (event.key === "Enter" || (event.key === " " && event.target === triggerRef.current)) { event.preventDefault(); if (!open) show(); else if (filtered[active]) choose(filtered[active]); }
  }

  return <span ref={rootRef} className={`ui-select ${className}`} style={style} data-disabled={disabled || undefined} data-invalid={invalid || props["aria-invalid"] || undefined}>
    <button ref={triggerRef} id={id} type="button" role="combobox" className="ui-select-trigger" disabled={disabled} aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-required={required} aria-invalid={invalid || props["aria-invalid"] || undefined} aria-activedescendant={open ? `${listId}-${active}` : undefined} onClick={() => open ? setOpen(false) : show()} onKeyDown={keyDown}>
      <span className="ui-select-value">{label}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <select {...props} id={id ? `${id}-native` : undefined} ref={node => { nativeRef.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; }} className="ui-select-native" tabIndex={-1} aria-hidden="true" disabled={disabled} required={required} value={value ?? internal} onChange={event => { setInternal(event.target.value); onChange?.(event); }} onInvalid={event => { event.preventDefault(); setInvalid(true); triggerRef.current?.focus(); props.onInvalid?.(event); }}>{children}</select>
    {open ? createPortal(<div ref={panelRef} className="ui-select-popover" style={position} onKeyDown={keyDown}>
      {searchable || options.length > 8 ? <input className="ui-select-search" placeholder="Suchen ..." aria-label="Optionen durchsuchen" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} autoFocus /> : null}
      <div id={listId} role="listbox" aria-label={props["aria-label"] ?? "Auswahl"}>{filtered.map((option, index) => <React.Fragment key={`${option.value}-${index}`}>{option.group && option.group !== filtered[index - 1]?.group ? <div className="ui-select-group">{option.group}</div> : null}<div id={`${listId}-${index}`} role="option" aria-selected={option.value === selected} aria-disabled={option.disabled} data-active={active === index} className="ui-select-option" onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}><span>{option.label}</span>{option.value === selected ? <span aria-hidden="true">✓</span> : null}</div></React.Fragment>)}{!filtered.length ? <p className="ui-select-empty">Keine Ergebnisse</p> : null}</div>
    </div>, document.body) : null}
  </span>;
}
