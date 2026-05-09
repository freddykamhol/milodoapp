"use client";

import * as React from "react";

import { Badge, Card } from "../../../_components/ui";

type Viewer = { role: "ADMIN" | "VERWALTUNG" | "PERSONAL" | "KUNDE" };

type Smtp = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  secure: boolean;
};

type Sftp = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
};

type TelegramChat = { id: number; enabled: boolean; name: string; chatId: string; inviteUrl: string; kindsJson: string };
type Telegram = { botToken: string; chats: TelegramChat[] };

type ProwlKey = { id: number; enabled: boolean; label: string; apiKey: string };

const telegramKinds = [
  { key: "NEW_SHIFT", label: "Neuer Dienst" },
  { key: "SHIFT_CHANGE", label: "Dienständerung" },
  { key: "URGENT_REQUESTS", label: "Akutabfragen" },
  { key: "REQUESTS_GENERAL", label: "Abfragen allgemein" },
  { key: "SHIFT_REMINDER", label: "Diensterinnerung" },
  { key: "TIMESHEET", label: "Stundenzettel" },
  { key: "BIRTHDAY", label: "Geburtstag" },
] as const;

function safeParseKinds(raw: string) {
  try {
    const v = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function normalizeTelegramJoinLink(input: string) {
  const raw = input.trim();
  if (!raw) return "";

  const withoutProto = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^tg:\/\//i, "")
    .trim();

  const withoutDomain = withoutProto.startsWith("t.me/") ? withoutProto.slice("t.me/".length) : withoutProto;
  const path = withoutDomain.replace(/^\//, "");
  if (!path) return "";

  if (path.startsWith("@")) return `https://t.me/${path.slice(1)}`;
  if (path.startsWith("+")) return `https://t.me/${path}`;
  if (path.startsWith("joinchat/")) return `https://t.me/${path}`;
  if (/^[a-zA-Z0-9_]{4,}$/.test(path)) return `https://t.me/${path}`;

  // fallback: keep as-is if it still looks like a link
  if (/^t\.me\//i.test(withoutProto)) return `https://${withoutProto}`;
  if (/^https?:\/\//i.test(raw)) return raw;

  return `https://t.me/${encodeURIComponent(path)}`;
}

function CircleToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "grid h-6 w-6 place-items-center rounded-full border transition",
        checked
          ? "border-transparent bg-[color:var(--accent)] text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_30%,transparent)]"
          : "border-[var(--border)] bg-[var(--surface)] text-transparent hover:bg-[var(--surface-2)]",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M4.5 10.5 8.2 14.2 15.8 6.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function IntegrationsClient({
  viewer,
  initialSmtp,
  initialTelegram,
  initialSftp,
  telegramJoinLinks,
  initialProwlKeys,
}: {
  viewer: Viewer;
  initialSmtp: Smtp | null;
  initialTelegram: Telegram | null;
  initialSftp: Sftp | null;
  telegramJoinLinks: Array<{ name: string; inviteUrl: string }>;
  initialProwlKeys: ProwlKey[];
}) {
  const isAdmin = viewer.role === "ADMIN" || viewer.role === "VERWALTUNG";
  const isAdminOnly = viewer.role === "ADMIN";
  const [copied, setCopied] = React.useState(false);

  const [smtp, setSmtp] = React.useState<Smtp | null>(initialSmtp);
  const [sftp, setSftp] = React.useState<Sftp | null>(initialSftp);
  const [telegram, setTelegram] = React.useState<Telegram | null>(initialTelegram);
  const [prowlKeys, setProwlKeys] = React.useState<ProwlKey[]>(initialProwlKeys);

  const [busy, setBusy] = React.useState<string | null>(null);
  const [testState, setTestState] = React.useState<{ key: string; ok: boolean } | null>(null);
  const [addChat, setAddChat] = React.useState({ name: "", chatId: "", inviteUrl: "" });
  const [addProwl, setAddProwl] = React.useState({ label: "", apiKey: "" });

  const webcalLink = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    const host = window.location.host;
    return `webcal://${host}/api/calendar/webcal`;
  }, []);

  async function copyWebcal() {
    try {
      await navigator.clipboard.writeText(webcalLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  async function saveSmtp(next: Partial<Smtp>) {
    if (!smtp) return;
    setBusy("smtp");
    try {
      const payload = { ...smtp, ...next };
      const res = await fetch("/api/settings/integrations/smtp", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save_failed");
      setSmtp(payload);
    } finally {
      setBusy(null);
    }
  }

  async function saveSftp(next: Partial<Sftp>) {
    if (!sftp) return;
    setBusy("sftp");
    try {
      const payload = { ...sftp, ...next };
      const res = await fetch("/api/settings/integrations/sftp", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save_failed");
      setSftp(payload);
    } finally {
      setBusy(null);
    }
  }

  async function saveTelegramToken(botToken: string) {
    if (!telegram) return;
    setBusy("telegram-token");
    try {
      const res = await fetch("/api/settings/integrations/telegram", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botToken }),
      });
      if (!res.ok) throw new Error("save_failed");
      setTelegram((s) => (s ? { ...s, botToken } : s));
    } finally {
      setBusy(null);
    }
  }

  async function addTelegramChat() {
    if (!telegram) return;
    const name = addChat.name.trim();
    const chatId = addChat.chatId.trim();
    const inviteUrl = addChat.inviteUrl.trim();
    if (!name || !chatId) return;
    setBusy("telegram-add");
    try {
      const res = await fetch("/api/settings/integrations/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, chatId, inviteUrl }),
      });
      if (!res.ok) throw new Error("add_failed");
      const data = (await res.json()) as { ok: boolean; id: number | null };
      if (data.ok && data.id) {
        const nextInviteUrl = normalizeTelegramJoinLink(inviteUrl) || normalizeTelegramJoinLink(name);
        setTelegram((s) =>
          s
            ? {
                ...s,
                chats: [...s.chats, { id: data.id!, enabled: true, name, chatId, inviteUrl: nextInviteUrl, kindsJson: "[]" }],
              }
            : s,
        );
      }
      setAddChat({ name: "", chatId: "", inviteUrl: "" });
    } finally {
      setBusy(null);
    }
  }

  async function patchTelegramChat(id: number, update: Partial<TelegramChat>) {
    setBusy(`telegram-${id}`);
    try {
      const res = await fetch(`/api/settings/integrations/telegram/chats/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error("save_failed");
      setTelegram((s) =>
        s ? { ...s, chats: s.chats.map((c) => (c.id === id ? { ...c, ...update } : c)) } : s,
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteTelegramChat(id: number) {
    if (!confirm("Chat wirklich löschen?")) return;
    setBusy(`telegram-del-${id}`);
    try {
      const res = await fetch(`/api/settings/integrations/telegram/chats/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      setTelegram((s) => (s ? { ...s, chats: s.chats.filter((c) => c.id !== id) } : s));
    } finally {
      setBusy(null);
    }
  }

  async function addProwlKey() {
    const label = addProwl.label.trim();
    const apiKey = addProwl.apiKey.trim();
    if (!label || !apiKey) return;
    setBusy("prowl-add");
    try {
      const res = await fetch("/api/settings/integrations/prowl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, apiKey }),
      });
      if (!res.ok) throw new Error("add_failed");
      const data = (await res.json()) as { ok: boolean; id: number | null };
      if (data.ok && data.id) {
        setProwlKeys((s) => [...s, { id: data.id!, enabled: true, label, apiKey }]);
      }
      setAddProwl({ label: "", apiKey: "" });
    } finally {
      setBusy(null);
    }
  }

  async function patchProwlKey(id: number, update: Partial<ProwlKey>) {
    setBusy(`prowl-${id}`);
    try {
      const res = await fetch(`/api/settings/integrations/prowl/keys/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error("save_failed");
      setProwlKeys((s) => s.map((k) => (k.id === id ? { ...k, ...update } : k)));
    } finally {
      setBusy(null);
    }
  }

  async function deleteProwlKey(id: number) {
    if (!confirm("Code wirklich löschen?")) return;
    setBusy(`prowl-del-${id}`);
    try {
      const res = await fetch(`/api/settings/integrations/prowl/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      setProwlKeys((s) => s.filter((k) => k.id !== id));
    } finally {
      setBusy(null);
    }
  }

  async function runTest(key: string, fn: () => Promise<Response>) {
    setBusy(key);
    setTestState(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        window.alert(data?.message || "Test fehlgeschlagen.");
        setTestState({ key, ok: false });
        return;
      }
      setTestState({ key, ok: true });
      window.setTimeout(() => setTestState(null), 1800);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Online-Kalender"
        description="Dauersynchronisation • keine Terminbearbeitung durch externe Geräte"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
            value={webcalLink}
            readOnly
            aria-label="Webcal Link"
          />
          <button
            type="button"
            onClick={() => void copyWebcal()}
            className="shrink-0 rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95"
          >
            {copied ? "Kopiert" : "Kopieren"}
          </button>
        </div>
      </Card>

      {isAdmin && smtp ? (
        <Card
          title="Mail"
          description="Nur SMTP-Festlegung (Versand später)."
          actions={
            <button
              type="button"
              disabled={busy === "smtp" || busy === "smtp-test" || !smtp.enabled}
              onClick={() =>
                void runTest("smtp-test", () => fetch("/api/settings/integrations/smtp/test", { method: "POST" }))
              }
              className={[
                "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                smtp.enabled
                  ? "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  : "border-[var(--border)] bg-[var(--surface)] opacity-50",
              ].join(" ")}
            >
              {busy === "smtp-test"
                ? "Teste…"
                : testState?.key === "smtp-test" && testState.ok
                  ? "OK"
                  : "Test"}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Aktiv</span>
              <div className="mt-1">
                <CircleToggle
                  checked={smtp.enabled}
                  disabled={busy === "smtp"}
                  label="SMTP aktiv"
                  onChange={(next) => void saveSmtp({ enabled: next })}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Secure (TLS)</span>
              <div className="mt-1">
                <CircleToggle
                  checked={smtp.secure}
                  disabled={busy === "smtp"}
                  label="SMTP secure"
                  onChange={(next) => void saveSmtp({ secure: next })}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Host</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={smtp.host}
                onChange={(e) => setSmtp((s) => (s ? { ...s, host: e.target.value } : s))}
                onBlur={() => void saveSmtp({ host: smtp.host })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Port</span>
              <input
                inputMode="numeric"
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={String(smtp.port)}
                onChange={(e) => setSmtp((s) => (s ? { ...s, port: Number(e.target.value) } : s))}
                onBlur={() => void saveSmtp({ port: smtp.port })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Username</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={smtp.username}
                onChange={(e) => setSmtp((s) => (s ? { ...s, username: e.target.value } : s))}
                onBlur={() => void saveSmtp({ username: smtp.username })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Passwort</span>
              <input
                type="password"
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={smtp.password}
                onChange={(e) => setSmtp((s) => (s ? { ...s, password: e.target.value } : s))}
                onBlur={() => void saveSmtp({ password: smtp.password })}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">From E-Mail</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={smtp.fromEmail}
                onChange={(e) => setSmtp((s) => (s ? { ...s, fromEmail: e.target.value } : s))}
                onBlur={() => void saveSmtp({ fromEmail: smtp.fromEmail })}
              />
            </label>
          </div>
        </Card>
      ) : null}

      {isAdminOnly && sftp ? (
        <Card
          title="SFTP"
          description="Nur Admin • Konfiguration für zukünftige Syncs/Uploads."
          actions={
            <button
              type="button"
              disabled={busy === "sftp" || busy === "sftp-test" || !sftp.enabled}
              onClick={() =>
                void runTest("sftp-test", () => fetch("/api/settings/integrations/sftp/test", { method: "POST" }))
              }
              className={[
                "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                sftp.enabled
                  ? "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  : "border-[var(--border)] bg-[var(--surface)] opacity-50",
              ].join(" ")}
            >
              {busy === "sftp-test"
                ? "Teste…"
                : testState?.key === "sftp-test" && testState.ok
                  ? "OK"
                  : "Test"}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Aktiv</span>
              <div className="mt-1">
                <CircleToggle
                  checked={sftp.enabled}
                  disabled={busy === "sftp"}
                  label="SFTP aktiv"
                  onChange={(next) => void saveSftp({ enabled: next })}
                />
              </div>
            </label>

            <div className="hidden md:block" />

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Host</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={sftp.host}
                onChange={(e) => setSftp((s) => (s ? { ...s, host: e.target.value } : s))}
                onBlur={() => void saveSftp({ host: sftp.host })}
                placeholder="sftp.example.com"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Port</span>
              <input
                inputMode="numeric"
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={String(sftp.port)}
                onChange={(e) => setSftp((s) => (s ? { ...s, port: Number(e.target.value) } : s))}
                onBlur={() => void saveSftp({ port: sftp.port })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Username</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={sftp.username}
                onChange={(e) => setSftp((s) => (s ? { ...s, username: e.target.value } : s))}
                onBlur={() => void saveSftp({ username: sftp.username })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Passwort</span>
              <input
                type="password"
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={sftp.password}
                onChange={(e) => setSftp((s) => (s ? { ...s, password: e.target.value } : s))}
                onBlur={() => void saveSftp({ password: sftp.password })}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Remote-Pfad</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={sftp.remotePath}
                onChange={(e) => setSftp((s) => (s ? { ...s, remotePath: e.target.value } : s))}
                onBlur={() => void saveSftp({ remotePath: sftp.remotePath })}
                placeholder="/uploads"
              />
            </label>
          </div>
        </Card>
      ) : null}

      {isAdmin && telegram ? (
        <Card
          title="Telegram"
          description="API-Code (Bot) + Chats mit Titel, Chat-ID und Invite-Link."
          actions={
            <button
              type="button"
              disabled={busy?.startsWith("telegram") || busy === "telegram-test" || !telegram.botToken.trim()}
              onClick={() =>
                void runTest("telegram-test", () =>
                  fetch("/api/settings/integrations/telegram/test", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: "{}",
                  }),
                )
              }
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--surface-2)] disabled:opacity-60"
            >
              {busy === "telegram-test"
                ? "Teste…"
                : testState?.key === "telegram-test" && testState.ok
                  ? "OK"
                  : "Test"}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Bot Token</span>
              <input
                className="mt-1 h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                value={telegram.botToken}
                onChange={(e) => setTelegram((s) => (s ? { ...s, botToken: e.target.value } : s))}
                onBlur={() => void saveTelegramToken(telegram.botToken)}
              />
            </label>

            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-[color:var(--muted)]">Chats</p>

              <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="hidden grid-cols-12 gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)] lg:grid">
                  <div className="col-span-1 text-center">Aktiv</div>
                  <div className="col-span-4">Titel</div>
                  <div className="col-span-3">Chat ID</div>
                  <div className="col-span-3">Join-Link</div>
                  <div className="col-span-1 text-right">Aktion</div>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {telegram.chats.map((c) => {
                    const isBusy = busy?.includes(`telegram-${c.id}`) || busy === `telegram-del-${c.id}`;
                    const selectedKinds = safeParseKinds(c.kindsJson);
                    const selectedSet = new Set(selectedKinds);
                    return (
                      <li key={c.id} className="grid grid-cols-12 items-start gap-3 px-4 py-3 lg:items-center">
                        <div className="col-span-2 flex justify-center sm:col-span-1">
                          <CircleToggle
                            checked={c.enabled}
                            disabled={!!isBusy}
                            label={`Telegram Chat aktiv ${c.name}`}
                            onChange={(next) => void patchTelegramChat(c.id, { enabled: next })}
                          />
                        </div>

                        <div className="col-span-10 sm:col-span-7 lg:col-span-4">
                          <input
                            className="h-10 w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                            value={c.name}
                            onChange={(e) =>
                              setTelegram((s) =>
                                s
                                  ? {
                                      ...s,
                                      chats: s.chats.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)),
                                    }
                                  : s,
                              )
                            }
                            onBlur={() => {
                              const nextName = c.name.trim();
                              const nextInvite = c.inviteUrl.trim() ? c.inviteUrl : normalizeTelegramJoinLink(nextName);
                              setTelegram((s) =>
                                s
                                  ? {
                                      ...s,
                                      chats: s.chats.map((x) =>
                                        x.id === c.id ? { ...x, name: nextName, inviteUrl: nextInvite } : x,
                                      ),
                                    }
                                  : s,
                              );
                              void patchTelegramChat(c.id, { name: nextName, inviteUrl: nextInvite });
                            }}
                          />
                        </div>

                        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                          <input
                            className="h-10 w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                            value={c.chatId}
                            placeholder="z.B. -1001234567890"
                            onChange={(e) =>
                              setTelegram((s) =>
                                s
                                  ? {
                                      ...s,
                                      chats: s.chats.map((x) => (x.id === c.id ? { ...x, chatId: e.target.value } : x)),
                                    }
                                  : s,
                              )
                            }
                            onBlur={() => void patchTelegramChat(c.id, { chatId: c.chatId })}
                          />
                        </div>

                        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                          <input
                            className="h-10 w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                            value={c.inviteUrl}
                            placeholder="https://t.me/+… oder https://t.me/joinchat/…"
                            onChange={(e) =>
                              setTelegram((s) =>
                                s
                                  ? {
                                      ...s,
                                      chats: s.chats.map((x) => (x.id === c.id ? { ...x, inviteUrl: e.target.value } : x)),
                                    }
                                  : s,
                              )
                            }
                            onBlur={() => {
                              const next = normalizeTelegramJoinLink(c.inviteUrl);
                              setTelegram((s) =>
                                s ? { ...s, chats: s.chats.map((x) => (x.id === c.id ? { ...x, inviteUrl: next } : x)) } : s,
                              );
                              void patchTelegramChat(c.id, { inviteUrl: next });
                            }}
                          />
                        </div>

                        <div className="col-span-12">
                          <p className="text-[11px] font-semibold text-[color:var(--muted)]">
                            Benachrichtigungsarten (leer = alle)
                          </p>
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {telegramKinds.map((k) => {
                              const checked = selectedSet.has(k.key);
                              return (
                                <label
                                  key={k.key}
                                  className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                                >
                                  <span className="text-xs font-semibold">{k.label}</span>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!!isBusy}
                                    onChange={(e) => {
                                      const next = new Set(selectedSet);
                                      if (e.target.checked) next.add(k.key);
                                      else next.delete(k.key);
                                      const kindsJson = JSON.stringify(Array.from(next));
                                      setTelegram((s) =>
                                        s
                                          ? {
                                              ...s,
                                              chats: s.chats.map((x) => (x.id === c.id ? { ...x, kindsJson } : x)),
                                            }
                                          : s,
                                      );
                                      void patchTelegramChat(c.id, { kindsJson });
                                    }}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="col-span-12 flex justify-end sm:col-span-4 lg:col-span-1">
                          <button
                            type="button"
                            disabled={!!isBusy}
                            onClick={() => void deleteTelegramChat(c.id)}
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60 sm:w-auto"
                          >
                            Löschen
                          </button>
                        </div>
                      </li>
                    );
                  })}

                  <li className="grid grid-cols-12 items-start gap-3 px-4 py-3 lg:items-center">
                    <div className="col-span-2 flex justify-center sm:col-span-1">
                      <Badge tone="muted">Neu</Badge>
                    </div>
                    <div className="col-span-10 sm:col-span-7 lg:col-span-4">
                      <input
                        className="h-10 w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                        placeholder="z.B. @milodo_team (oder Titel)"
                        value={addChat.name}
                        onChange={(e) => setAddChat((s) => ({ ...s, name: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                      <input
                        className="h-10 w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                        placeholder="z.B. -1001234567890"
                        value={addChat.chatId}
                        onChange={(e) => setAddChat((s) => ({ ...s, chatId: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                      <input
                        className="h-10 w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                        placeholder="Invite-Link (optional)"
                        value={addChat.inviteUrl}
                        onChange={(e) => setAddChat((s) => ({ ...s, inviteUrl: e.target.value }))}
                        onBlur={() => setAddChat((s) => ({ ...s, inviteUrl: normalizeTelegramJoinLink(s.inviteUrl) }))}
                      />
                    </div>
                    <div className="col-span-12 flex justify-end sm:col-span-4 lg:col-span-1">
                      <button
                        type="button"
                        disabled={busy === "telegram-add" || !addChat.name.trim() || !addChat.chatId.trim()}
                        onClick={() => void addTelegramChat()}
                        className="w-full rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60 sm:w-auto"
                      >
                        Hinzufügen
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {!isAdmin ? (
        <Card title="Telegram Chats" description="Links anzeigen und direkt beitreten.">
          {telegramJoinLinks.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {telegramJoinLinks.map((c) => (
                <a
                  key={`${c.name}:${c.inviteUrl}`}
                  href={c.inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:bg-[var(--surface-2)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="mt-1 truncate text-xs text-[color:var(--muted)]">{c.inviteUrl}</p>
                  </div>
                  <Badge tone="accent">Beitreten</Badge>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[color:var(--muted)]">Keine Chat-Links hinterlegt.</p>
          )}
        </Card>
      ) : null}

      <Card title="Prowl" description="Mehrere Codes möglich (nur für deinen User).">
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[80px_1fr_260px_220px] gap-3 bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]">
              <div className="text-center">Aktiv</div>
              <div>Name</div>
              <div>Code</div>
              <div className="text-right">Aktion</div>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {prowlKeys.map((k) => {
                const isBusy = busy?.includes(`prowl-${k.id}`) || busy === `prowl-del-${k.id}`;
                return (
                  <li key={k.id} className="grid grid-cols-[80px_1fr_260px_220px] items-center gap-3 px-4 py-3">
                    <div className="flex justify-center">
                      <CircleToggle
                        checked={k.enabled}
                        disabled={!!isBusy}
                        label={`Prowl aktiv ${k.label}`}
                        onChange={(next) => void patchProwlKey(k.id, { enabled: next })}
                      />
                    </div>
                    <input
                      className="h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                      value={k.label}
                      onChange={(e) => setProwlKeys((s) => s.map((x) => (x.id === k.id ? { ...x, label: e.target.value } : x)))}
                      onBlur={() => void patchProwlKey(k.id, { label: k.label })}
                    />
                    <input
                      className="h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                      value={k.apiKey}
                      onChange={(e) => setProwlKeys((s) => s.map((x) => (x.id === k.id ? { ...x, apiKey: e.target.value } : x)))}
                      onBlur={() => void patchProwlKey(k.id, { apiKey: k.apiKey })}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={!k.enabled || !!isBusy || busy === `prowl-test-${k.id}`}
                        onClick={() =>
                          void runTest(`prowl-test-${k.id}`, () =>
                            fetch("/api/settings/integrations/prowl/test", {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ keyId: k.id }),
                            }),
                          )
                        }
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
                      >
                        {busy === `prowl-test-${k.id}`
                          ? "Teste…"
                          : testState?.key === `prowl-test-${k.id}` && testState.ok
                            ? "OK"
                            : "Test"}
                      </button>
                      <button
                        type="button"
                        disabled={!!isBusy}
                        onClick={() => void deleteProwlKey(k.id)}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)] disabled:opacity-60"
                      >
                        Löschen
                      </button>
                    </div>
                  </li>
                );
              })}

              <li className="grid grid-cols-[80px_1fr_260px_220px] items-center gap-3 px-4 py-3">
                <div className="flex justify-center">
                  <Badge tone="muted">Neu</Badge>
                </div>
                <input
                  className="h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  placeholder="z.B. iPhone"
                  value={addProwl.label}
                  onChange={(e) => setAddProwl((s) => ({ ...s, label: e.target.value }))}
                />
                <input
                  className="h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--ring)]"
                  placeholder="Prowl API Key"
                  value={addProwl.apiKey}
                  onChange={(e) => setAddProwl((s) => ({ ...s, apiKey: e.target.value }))}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={busy === "prowl-add" || !addProwl.label.trim() || !addProwl.apiKey.trim()}
                    onClick={() => void addProwlKey()}
                    className="rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:brightness-95 disabled:opacity-60"
                  >
                    Hinzufügen
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
