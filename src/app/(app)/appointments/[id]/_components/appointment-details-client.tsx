"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { Badge, Card } from "../../../_components/ui";

type Viewer = {
  id: number;
  role: "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE";
  qualRD: string | null;
  qualAusb: string | null;
};
type Appointment = {
  id: number;
  startAt: Date;
  endAt: Date | null;
  title: string;
  einsatzort: string;
  customerId: number;
  bereich: "RD_BOERSE" | "SANITATSDIENST" | "ERSTE_HILFE";
  dienstart: string | null;
  eventName: string;
  notes: string;
  detailsJson: string;
  staffingStatus: "BESETZT" | "UNBESETZT" | "UNTERBESETZT";
  approved: boolean;
  state: "OPEN" | "CLOSED" | "CANCELLED";
  targetUserId: number | null;
};

type Requirement = { kind: "QUAL_RD" | "QUAL_AUSB"; value: string; minCount: number };
type FileRow = { id: number; fileName: string; mimeType: string; sizeBytes: number };
type ApplicationRow = {
  userId: number;
  username: string;
  role: string;
  qualRD: string | null;
  qualAusb: string | null;
  status: "REPORTED" | "CONFIRMED" | "CANCELLED";
  appRole: "NORMAL" | "EL";
  adminNote: string;
};

type SectionRow = { id: number; title: string; sortOrder: number };
type SectionMemberRow = { sectionId: number; userId: number; username: string; qualRD: string | null; qualAusb: string | null };
type MemberRow = { id: number; username: string; role: string; qualRD: string | null; qualAusb: string | null };

type DetailsJson = {
  serviceType?: string;
  rdType?: string | null;
  customer?: Record<string, unknown>;
  location?: { name?: string; street?: string; houseNumber?: string; plz?: string; city?: string };
  visitors?: number | null;
  participants?: string[];
  assets?: Array<{ item?: string; count?: number }>;
};

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(d);
}

function formatTimeRange(startAt: Date, endAt: Date | null) {
  if (!endAt) return formatTime(startAt);
  return `${formatTime(startAt)}–${formatTime(endAt)}`;
}

function safeParseDetails(raw: string): DetailsJson {
  try {
    const obj = JSON.parse(raw || "{}") as unknown;
    return obj && typeof obj === "object" ? (obj as DetailsJson) : {};
  } catch {
    return {};
  }
}

function qualLabel(qualRD: string | null, qualAusb: string | null) {
  const parts: string[] = [];
  if (qualRD) parts.push(`RD: ${qualRD}`);
  if (qualAusb) parts.push(`Ausb: ${qualAusb}`);
  return parts.length ? parts.join(" • ") : "—";
}

function relevantQualBadge(viewer: Viewer, requirements: Requirement[]) {
  if (!requirements.length) return null;

  const hasRdReq = requirements.some((r) => r.kind === "QUAL_RD");
  const hasAusbReq = requirements.some((r) => r.kind === "QUAL_AUSB");

  if (hasRdReq && viewer.qualRD && requirements.some((r) => r.kind === "QUAL_RD" && r.value === viewer.qualRD)) {
    return { tone: "accent" as const, label: `Qual: ${viewer.qualRD}` };
  }
  if (
    hasAusbReq &&
    viewer.qualAusb &&
    requirements.some((r) => r.kind === "QUAL_AUSB" && r.value === viewer.qualAusb)
  ) {
    return { tone: "accent" as const, label: `Qual: ${viewer.qualAusb}` };
  }

  return null;
}

function PersonMenu({
  disabled,
  actions,
}: {
  disabled?: boolean;
  actions: Array<{ label: string; tone?: "danger" | "accent"; onClick: () => void }>;
}) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const update = React.useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 220;
    const left = Math.min(Math.max(12, rect.right - menuWidth), window.innerWidth - menuWidth - 12);
    const belowTop = rect.bottom + 10;
    const aboveTop = rect.top - 10;
    const h = menuRef.current?.getBoundingClientRect().height ?? 0;
    const fitsBelow = belowTop + h <= window.innerHeight - 12;
    const top = fitsBelow ? belowTop : Math.max(12, aboveTop - h);
    setPos({ top, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const btn = buttonRef.current;
      const menu = menuRef.current;
      if (event.target instanceof Node && (btn?.contains(event.target) || menu?.contains(event.target))) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => update());
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
  }, [open, update]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) update();
        }}
        className="list-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(11,18,32,0.05)] transition hover:bg-[var(--surface-2)] hover:text-[color:var(--foreground)] disabled:opacity-60"
        aria-label="Aktionen"
        aria-expanded={open}
      >
        ⋯
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[60] w-[220px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
              style={{ top: pos.top, left: pos.left }}
              role="menu"
            >
              {actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    a.onClick();
                  }}
                  className={[
                    "block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-2)]",
                    a.tone === "danger" ? "text-[color:var(--danger)]" : a.tone === "accent" ? "text-[color:var(--accent)]" : "",
                  ].join(" ")}
                >
                  {a.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function AppointmentDetailsClient({
  viewer,
  canAdmin,
  appointment,
  customer,
  requirements,
  files,
  applications,
  sections,
  sectionMembers,
  allMembers,
}: {
  viewer: Viewer;
  canAdmin: boolean;
  appointment: Appointment;
  customer: {
    id: number;
    name: string;
    contactName: string;
    street: string;
    houseNumber: string;
    plz: string;
    city: string;
    email: string;
    phone: string;
  } | null;
  requirements: Requirement[];
  files: FileRow[];
  applications: ApplicationRow[];
  sections: SectionRow[];
  sectionMembers: SectionMemberRow[];
  allMembers: MemberRow[];
}) {
  const router = useRouter();
  const details = React.useMemo(() => safeParseDetails(appointment.detailsJson), [appointment.detailsJson]);
  const [busyUserId, setBusyUserId] = React.useState<number | null>(null);
  const [flash, setFlash] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [addingSection, setAddingSection] = React.useState(false);
  const [newSectionTitle, setNewSectionTitle] = React.useState("");
  const [selectedMemberId, setSelectedMemberId] = React.useState<number | "">("");
  const [approved, setApproved] = React.useState(Boolean(appointment.approved));
  const [releaseBusy, setReleaseBusy] = React.useState(false);
  const [releaseHint, setReleaseHint] = React.useState<string | null>(null);

  const reported = applications.filter((a) => a.status === "REPORTED");
  const confirmed = applications
    .filter((a) => a.status === "CONFIRMED")
    .slice()
    .sort((a, b) => (b.appRole === "EL" ? 1 : 0) - (a.appRole === "EL" ? 1 : 0) || a.username.localeCompare(b.username));

  const sectionMembersBySection = React.useMemo(() => {
    const map = new Map<number, SectionMemberRow[]>();
    for (const m of sectionMembers) {
      const list = map.get(m.sectionId) ?? [];
      list.push(m);
      map.set(m.sectionId, list);
    }
    for (const [, v] of map) v.sort((a, b) => a.username.localeCompare(b.username));
    return map;
  }, [sectionMembers]);

  const assignedUserIds = React.useMemo(() => new Set(sectionMembers.map((m) => m.userId)), [sectionMembers]);
  const confirmedUnassigned = confirmed.filter((c) => !assignedUserIds.has(c.userId));
  const confirmedIds = React.useMemo(() => {
    const set = new Set<number>();
    for (const c of applications) if (c.status === "CONFIRMED") set.add(c.userId);
    return set;
  }, [applications]);

  const customerAddress = customer
    ? [customer.street, customer.houseNumber].filter(Boolean).join(" ").trim() || "—"
    : "—";
  const customerCity = customer ? [customer.plz, customer.city].filter(Boolean).join(" ").trim() || "—" : "—";

  const location = details?.location ?? {};
  const locationAddress = [location.street, location.houseNumber].filter(Boolean).join(" ").trim();
  const locationCity = [location.plz, location.city].filter(Boolean).join(" ").trim();

  const assets = Array.isArray(details?.assets) ? (details.assets as Array<{ item?: string; count?: number }>) : [];
  const participants = Array.isArray(details?.participants) ? (details.participants as string[]) : [];
  const visitors = typeof details?.visitors === "number" ? (details.visitors as number) : null;

  const viewerApplication = React.useMemo(
    () => applications.find((a) => a.userId === viewer.id) ?? null,
    [applications, viewer.id],
  );

  async function report() {
    setBusyUserId(viewer.id);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/report`, { method: "POST" });
      if (!res.ok) throw new Error("report_failed");
      setFlash({
        tone: "success",
        text: "Du hast dich gemeldet. Eine Bestätigung wurde als Benachrichtigung hinterlegt und per E-Mail versendet (falls SMTP aktiv).",
      });
      window.setTimeout(() => setFlash(null), 6000);
      window.dispatchEvent(new CustomEvent("milodo:notifications:refresh"));
      router.refresh();
    } catch {
      setFlash({ tone: "danger", text: "Melden fehlgeschlagen (bitte später erneut versuchen)." });
      window.setTimeout(() => setFlash(null), 6000);
      window.alert("Melden fehlgeschlagen (bitte später erneut versuchen).");
    } finally {
      setBusyUserId(null);
    }
  }

  async function adminAssign(userId: number, role: "NORMAL" | "EL") {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/admin/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error("assign_failed");
      router.refresh();
    } catch {
      window.alert("Einteilen fehlgeschlagen.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function releaseAppointment() {
    if (!canAdmin) return;
    if (approved) return;
    setReleaseBusy(true);
    setReleaseHint(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/admin/release`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "release_failed");
      setApproved(true);
      setReleaseHint("Ausgelöst");
      window.dispatchEvent(new CustomEvent("milodo:notifications:refresh"));
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Freigabe fehlgeschlagen.";
      setReleaseHint(msg);
    } finally {
      setReleaseBusy(false);
    }
  }

  async function adminUnassign(userId: number) {
    const note = window.prompt("Bemerkung zum Austragen (optional):", "") ?? "";
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/admin/unassign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, note }),
      });
      if (!res.ok) throw new Error("unassign_failed");
      router.refresh();
    } catch {
      window.alert("Austragen fehlgeschlagen.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function adminToReported(userId: number) {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/admin/to-reported`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("to_reported_failed");
      router.refresh();
    } catch {
      window.alert("Umwandeln in Meldung fehlgeschlagen.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function adminSetRole(userId: number, role: "NORMAL" | "EL") {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/admin/role`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error("set_role_failed");
      router.refresh();
    } catch {
      window.alert("Rolle ändern fehlgeschlagen.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function createSection() {
    const title = newSectionTitle.trim();
    if (!title) return;
    setAddingSection(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/admin/sections/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("create_failed");
      setNewSectionTitle("");
      router.refresh();
    } catch {
      window.alert("Abschnitt konnte nicht angelegt werden.");
    } finally {
      setAddingSection(false);
    }
  }

  async function assignToSection(sectionId: number, userId: number) {
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/admin/sections/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sectionId, userId }),
      });
      if (!res.ok) throw new Error("assign_failed");
      router.refresh();
    } catch {
      window.alert("Zuordnung fehlgeschlagen.");
    }
  }

  async function removeFromSection(sectionId: number, userId: number) {
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/admin/sections/remove`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sectionId, userId }),
      });
      if (!res.ok) throw new Error("remove_failed");
      router.refresh();
    } catch {
      window.alert("Entfernen fehlgeschlagen.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {flash ? (
        <div
          className={[
            "rounded-3xl border border-[var(--border)] px-4 py-3 text-sm font-semibold shadow-[var(--shadow-soft)]",
            flash.tone === "success"
              ? "bg-[color:color-mix(in_oklab,var(--success)_10%,transparent)] text-[color:var(--success)]"
              : "bg-[color:color-mix(in_oklab,var(--danger)_10%,transparent)] text-[color:var(--danger)]",
          ].join(" ")}
        >
          {flash.text}
        </div>
      ) : null}
      {!approved ? (
        <Card title="Freigabe ausstehend" description="Dieser Dienst ist noch nicht freigegeben.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge tone="danger">Noch nicht freigegeben</Badge>
            {canAdmin ? (
              <button
                type="button"
                disabled={releaseBusy}
                onClick={() => void releaseAppointment()}
                className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
              >
                {releaseBusy ? "Freigabe…" : "Freigeben + Abfrage starten"}
              </button>
            ) : null}
          </div>
          {releaseHint ? <p className="mt-3 text-xs font-semibold text-[color:var(--muted)]">{releaseHint}</p> : null}
        </Card>
      ) : null}
      <Card
        title="Übersicht"
        description="Alle Informationen zum Dienst auf einen Blick."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{appointment.state}</Badge>
            <Badge tone="muted">{appointment.staffingStatus}</Badge>
            {appointment.targetUserId ? <Badge tone="warning">Zielzuweisung</Badge> : null}
            {(() => {
              const b = relevantQualBadge(viewer, requirements);
              return b ? <Badge tone={b.tone}>{b.label}</Badge> : null;
            })()}
          </div>
        }
      >
        {appointment.state === "OPEN" && viewer.role !== "KUNDE" && appointment.staffingStatus !== "BESETZT" ? (
          <div className="mb-4">
            <button
              type="button"
              disabled={busyUserId === viewer.id || viewerApplication?.status === "CONFIRMED"}
              onClick={() => void report()}
              className="w-full rounded-3xl bg-[color:var(--accent)] px-5 py-4 text-base font-bold text-white shadow-[0_16px_34px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
            >
              {viewerApplication?.status === "REPORTED" ? "Bereits gemeldet" : viewerApplication?.status === "CONFIRMED" ? "Bereits eingeteilt" : "Melden"}
            </button>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-semibold text-[color:var(--muted)]">Zeit</p>
            <p className="mt-1 text-sm font-semibold">{formatDateTime(appointment.startAt)}</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{formatTimeRange(appointment.startAt, appointment.endAt)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-semibold text-[color:var(--muted)]">Bereich</p>
            <p className="mt-1 text-sm font-semibold">{appointment.bereich}</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{appointment.dienstart ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:col-span-2">
            <p className="text-xs font-semibold text-[color:var(--muted)]">Titel</p>
            <p className="mt-1 text-sm font-semibold">{appointment.title}</p>
            {appointment.eventName ? <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">Event: {appointment.eventName}</p> : null}
          </div>
        </div>
      </Card>

      <Card title="Kunde" description="Kontaktdaten und Adresse.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-semibold text-[color:var(--muted)]">Firma</p>
            <p className="mt-1 text-sm font-semibold">{customer?.name ?? "—"}</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{customer?.contactName || "—"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-semibold text-[color:var(--muted)]">Adresse</p>
            <p className="mt-1 text-sm font-semibold">{customerAddress}</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{customerCity}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-semibold text-[color:var(--muted)]">E-Mail</p>
            <p className="mt-1 text-sm font-semibold">{customer?.email || "—"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-semibold text-[color:var(--muted)]">Telefon</p>
            <p className="mt-1 text-sm font-semibold">{customer?.phone || "—"}</p>
          </div>
        </div>
      </Card>

      <Card title="Einsatzort" description="Ort und Anschrift.">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs font-semibold text-[color:var(--muted)]">Einsatzort</p>
          {locationAddress || locationCity ? (
            <>
              <p className="mt-1 text-sm font-semibold">{locationAddress || "—"}</p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{locationCity || "—"}</p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold">{appointment.einsatzort}</p>
          )}
        </div>
      </Card>

      <Card title="Personal" description="Personalansatz und Anforderungen.">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs font-semibold text-[color:var(--muted)]">Personalansatz</p>
          <p className="mt-1 text-sm font-semibold">
            {requirements.length
              ? requirements
                  .slice()
                  .sort((a, b) => a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value))
                  .map((r) => `mind. ${r.minCount}× ${r.value}`)
                  .join(" • ")
              : "—"}
          </p>
        </div>
      </Card>

      {assets.length || typeof visitors === "number" || participants.length ? (
        <Card title="Material & Zusatz" description="Nur falls angegeben.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {assets.length ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <p className="text-xs font-semibold text-[color:var(--muted)]">Material / Fahrzeuge</p>
                <ul className="mt-2 space-y-1">
                  {assets.map((a, idx) => (
                    <li key={idx} className="text-sm font-semibold">
                      {Math.max(1, Number(a.count || 1))}× {String(a.item || "—")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {typeof visitors === "number" ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <p className="text-xs font-semibold text-[color:var(--muted)]">Geschätzte Besucher</p>
                <p className="mt-1 text-sm font-semibold">{String(visitors)}</p>
              </div>
            ) : null}
            {participants.length ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:col-span-2">
                <p className="text-xs font-semibold text-[color:var(--muted)]">Teilnehmer</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {participants.map((p, idx) => (
                    <div key={idx} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold">
                      {p || `Teilnehmer ${idx + 1}`}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card title="Bemerkung" description="Interne Hinweise zum Dienst.">
        <p className="text-sm font-semibold whitespace-pre-wrap">{appointment.notes?.trim() ? appointment.notes : "—"}</p>
      </Card>

      <Card title="Dienstdokument" description="Automatisch erzeugte PDFs.">
        {files.length ? (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{f.fileName}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">{Math.round((f.sizeBytes || 0) / 1024)} KB</p>
                </div>
                <a
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)]"
                  href={`/api/appointments/files/${f.id}/download`}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">Noch kein Dokument vorhanden.</p>
        )}
      </Card>

      {canAdmin ? (
        <Card title="Personal hinzufügen" description="Admin/Verwaltung kann Personal auch ohne Meldung einteilen.">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="block md:flex-1">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Mitglied</span>
              <select
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={selectedMemberId}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedMemberId(v ? Number(v) : "");
                }}
              >
                <option value="">Bitte wählen…</option>
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id} disabled={confirmedIds.has(m.id)}>
                    {m.username} {confirmedIds.has(m.id) ? "(bereits eingeteilt)" : ""} • {qualLabel(m.qualRD, m.qualAusb)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!selectedMemberId || busyUserId === selectedMemberId || confirmedIds.has(Number(selectedMemberId))}
                onClick={() => void adminAssign(Number(selectedMemberId), "NORMAL")}
                className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
              >
                Einteilen
              </button>
              <button
                type="button"
                disabled={!selectedMemberId || busyUserId === selectedMemberId || confirmedIds.has(Number(selectedMemberId))}
                onClick={() => void adminAssign(Number(selectedMemberId), "EL")}
                className="rounded-2xl border border-[color:color-mix(in_oklab,#f59e0b_35%,var(--border))] bg-[color:color-mix(in_oklab,#f59e0b_10%,var(--surface))] px-4 py-2 text-xs font-semibold text-[#b45309] hover:brightness-95 disabled:opacity-60"
              >
                Einteilen als EL
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card title="Meldungen / Eingeteilt" description="Statusübersicht für alle sichtbar.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold tracking-tight">Meldungen</p>
              <Badge tone="muted">{reported.length}</Badge>
            </div>
            {reported.length ? (
              <div className="mt-3 space-y-2">
                {reported.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {u.username}
                        {u.userId === viewer.id ? <span className="ml-2 text-[11px] font-semibold text-[color:var(--muted)]">(Du)</span> : null}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--muted)]">{qualLabel(u.qualRD, u.qualAusb)}</p>
                    </div>
                    {canAdmin ? (
                      <PersonMenu
                        disabled={busyUserId === u.userId}
                        actions={[
                          { label: "Einteilen", tone: "accent", onClick: () => void adminAssign(u.userId, "NORMAL") },
                          { label: "Einteilen als EL", onClick: () => void adminAssign(u.userId, "EL") },
                        ]}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--muted)]">Keine Meldungen.</p>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold tracking-tight">Eingeteilt</p>
              <Badge tone="muted">{confirmed.length}</Badge>
            </div>
            {confirmed.length ? (
              <div className="mt-3 space-y-2">
                {confirmed.map((u) => (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                    draggable={canAdmin && appointment.bereich === "SANITATSDIENST"}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(u.userId));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    title={canAdmin && appointment.bereich === "SANITATSDIENST" ? "Ziehen um Abschnitt zuzuordnen" : undefined}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {u.username}
                          {u.userId === viewer.id ? <span className="ml-2 text-[11px] font-semibold text-[color:var(--muted)]">(Du)</span> : null}
                        </p>
                        {u.appRole === "EL" ? <Badge tone="warning">EL</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--muted)]">{qualLabel(u.qualRD, u.qualAusb)}</p>
                    </div>
                    {canAdmin ? (
                      <PersonMenu
                        disabled={busyUserId === u.userId}
                        actions={[
                          { label: "Zu Meldung", tone: "accent", onClick: () => void adminToReported(u.userId) },
                          ...(u.appRole === "EL"
                            ? [{ label: "Als Normal", onClick: () => void adminSetRole(u.userId, "NORMAL") }]
                            : [{ label: "Als EL", onClick: () => void adminSetRole(u.userId, "EL") }]),
                          { label: "Austragen (mit Bemerkung)", tone: "danger", onClick: () => void adminUnassign(u.userId) },
                        ]}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--muted)]">Noch niemand eingeteilt.</p>
            )}
          </div>
        </div>
      </Card>

      {canAdmin && appointment.bereich === "SANITATSDIENST" ? (
        <Card title="Abschnitte / Fahrzeuge" description="Nur für Sanitätsdienst: Abschnitte anlegen und Personal zuordnen (Drag & Drop).">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="h-10 w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                placeholder="Neuer Abschnitt / Fahrzeug (z.B. RTW 1, Abschnitt A)…"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
              />
              <button
                type="button"
                disabled={addingSection || !newSectionTitle.trim()}
                onClick={() => void createSection()}
                className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
              >
                Hinzufügen
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-semibold tracking-tight">Ohne Abschnitt</p>
                <p className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">Ziehe Personen in einen Abschnitt.</p>
                <div className="mt-3 space-y-2">
                  {confirmedUnassigned.length ? (
                    confirmedUnassigned.map((u) => (
                      <div
                        key={u.userId}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", String(u.userId));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{u.username}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--muted)]">{qualLabel(u.qualRD, u.qualAusb)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted)]">Keine offenen Zuordnungen.</p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                {sections.map((s) => {
                  const members = sectionMembersBySection.get(s.id) ?? [];
                  return (
                    <div
                      key={s.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const userId = Number(e.dataTransfer.getData("text/plain"));
                        if (!Number.isFinite(userId)) return;
                        void assignToSection(s.id, userId);
                      }}
                      className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold tracking-tight">{s.title}</p>
                        <Badge tone="muted">{members.length}</Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {members.length ? (
                          members.map((m) => (
                            <div key={m.userId} className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{m.username}</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--muted)]">{qualLabel(m.qualRD, m.qualAusb)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void removeFromSection(s.id, m.userId)}
                                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[color:var(--danger)] hover:bg-[var(--surface-2)]"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[color:var(--muted)]">Drop hier…</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!sections.length ? (
                  <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[color:var(--muted)]">
                    Lege zuerst Abschnitte/Fahrzeuge an, dann kannst du Personal zuordnen.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
