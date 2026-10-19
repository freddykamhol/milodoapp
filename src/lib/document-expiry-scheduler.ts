import { sendDocumentExpiryReminders } from "@/lib/document-expiry-reminders";

const POLL_INTERVAL_MS = 60 * 60 * 1000;

declare global {
  // Keep a single poller through Next.js development reloads in this process.
  // eslint-disable-next-line no-var
  var documentExpiryScheduler: { timer: ReturnType<typeof setInterval>; running: boolean } | undefined;
}

export function startDocumentExpiryScheduler() {
  if (globalThis.documentExpiryScheduler) return;

  const state = { timer: undefined as unknown as ReturnType<typeof setInterval>, running: false };
  const poll = async () => {
    if (state.running) return;
    state.running = true;
    try {
      const result = await sendDocumentExpiryReminders();
      if (result.sent > 0) console.info(`[document-expiry] sent ${result.sent} reminder(s)`);
    } catch (error) {
      console.error("[document-expiry] reminder run failed", error);
    } finally {
      state.running = false;
    }
  };

  state.timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  state.timer.unref?.();
  globalThis.documentExpiryScheduler = state;
  void poll();
  console.info("[document-expiry] in-process reminder scheduler started (hourly)");
}
