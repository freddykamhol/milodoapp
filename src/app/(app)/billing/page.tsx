import { AppShell } from "../_components/app-shell";
import { Badge, Card, Kpi } from "../_components/ui";

export default function BillingPage() {
  return (
    <AppShell title="Abrechnung" subtitle="Übersicht, offene Posten und Export.">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <Kpi label="Offen" value="€ 1.240" change="+3%" tone="warning" />
        </Card>
        <Card className="p-5">
          <Kpi label="Eingegangen" value="€ 7.980" change="+9%" tone="success" />
        </Card>
        <Card className="p-5">
          <Kpi label="Rückfragen" value="2" change="-1" tone="accent" />
        </Card>
      </section>

      <Card title="Status" description="Beispielhaftes Abrechnungs-Panel.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Zahlungen OK</Badge>
          <Badge tone="warning">2 Rückfragen</Badge>
          <Badge tone="accent">Export bereit</Badge>
        </div>
      </Card>
    </AppShell>
  );
}

