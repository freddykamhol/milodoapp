import { AppShell } from "../_components/app-shell";
import { CalendarView } from "./_components/calendar-view";

export default function CalendarPage() {
  return (
    <AppShell title="Kalender" subtitle="Tag-, Wochen- und Monatsansicht für zugesagte Termine.">
      <CalendarView />
    </AppShell>
  );
}
