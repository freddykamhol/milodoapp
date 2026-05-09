import { AppShell } from "../../_components/app-shell";
import { Card } from "../../_components/ui";

import { PasswordChangeClient } from "./_components/password-change-client";

export default function PasswordPage() {
  return (
    <AppShell title="Passwort" subtitle="Sicherheits- und Login-Einstellungen.">
      <Card title="Passwort ändern" description="Du bist eingeloggt – setze ein neues Passwort.">
        <PasswordChangeClient />
      </Card>
    </AppShell>
  );
}

