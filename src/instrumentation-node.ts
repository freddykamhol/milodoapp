import { runMigrations } from "../scripts/migrate";
import { startDocumentExpiryScheduler } from "./lib/document-expiry-scheduler";
import { startMessageScheduler } from "./lib/message-scheduler";

export async function initializeNodeRuntime() {
  await runMigrations();
  startDocumentExpiryScheduler();
  startMessageScheduler();
}
