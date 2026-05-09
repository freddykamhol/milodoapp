import { AppShell } from "../_components/app-shell";
import { SettingsTabs, type ViewerRole } from "./_components/settings-tabs";

import { getViewer } from "@/lib/viewer";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const viewerRole = (viewer?.role ?? null) as ViewerRole | null;

  return (
    <AppShell title="Einstellungen" subtitle="Konfiguration und Auswertungen für dein Team.">
      <SettingsTabs viewerRole={viewerRole} />

      {children}
    </AppShell>
  );
}
