import { AppShell } from "../_components/app-shell";
import { Card } from "../_components/ui";

export default function PatientsPage() {
  return (
    <AppShell title="Patienten" subtitle="Stammdaten, Verlauf und Dokumente.">
      <Card title="In Arbeit" description="Diese Ansicht ist als Platzhalter angelegt.">
        <p className="text-sm text-[color:var(--muted)]">
          Hier kommt die Patientenliste (Filter, Suche, Detailansicht) im milodo-medical
          Look-and-feel hin.
        </p>
      </Card>
    </AppShell>
  );
}

