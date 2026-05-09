import * as React from "react";

type CardProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export type BadgeTone = "accent" | "success" | "warning" | "danger" | "muted";

export function Card({ title, description, actions, children, className }: CardProps) {
  return (
    <section
      className={[
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {title ? (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs text-[color:var(--muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}
      <div className={title ? "px-5 pb-5 pt-4" : "p-5"}>{children}</div>
    </section>
  );
}

type BadgeProps = {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ tone = "muted", children, className }: BadgeProps) {
  const toneClass =
    tone === "accent"
      ? "bg-[color:color-mix(in_oklab,var(--accent)_18%,transparent)] text-[color:var(--accent)]"
      : tone === "success"
        ? "bg-[color:color-mix(in_oklab,var(--success)_18%,transparent)] text-[color:var(--success)]"
        : tone === "warning"
          ? "bg-[color:color-mix(in_oklab,var(--warning)_20%,transparent)] text-[color:var(--warning)]"
          : tone === "danger"
            ? "bg-[color:color-mix(in_oklab,var(--danger)_18%,transparent)] text-[color:var(--danger)]"
            : "bg-[color:var(--surface-2)] text-[color:var(--muted)]";

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight",
        toneClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

export function Kpi({
  label,
  value,
  change,
  tone = "accent",
}: {
  label: string;
  value: string;
  change: string;
  tone?: Exclude<BadgeTone, "muted">;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-[color:var(--muted)]">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      </div>
      <Badge tone={tone}>{change}</Badge>
    </div>
  );
}

