# Mangeltermine

Fahrzeug- und Medizinprodukt-Mängel verwenden dieselbe Terminverwaltung. Admins und Verwaltung können auf der Mangel-Detailseite Termine erstellen sowie bestehende Termine dort und auf der Fahrzeug-/MP-Detailseite bearbeiten, verschieben und nach Bestätigung löschen. Personal kann die Termine lesen, Kunden erhalten keinen Zugriff.

## Daten und Anzeige

- Titel, Beginn, optionales Ende, optionale Firma, Ort/Adresse und Beschreibung.
- Gespeicherte Wartungsfirmen sind auswählbar; ihre Adresse wird vorgeschlagen. Ein freier Ort ist ebenfalls möglich.
- Unter „Fuhrpark & Material → Wartungsfirmen“ können Admins und Verwaltung Firmen mit mehrteiliger Adresse, Telefon, E-Mail und Ansprechpartner zentral anlegen. Der eigenständige Menüpunkt führt auf `/maintenance-companies`; in den Untermenüs von Fahrzeugen und Inventar gibt es keine Firmeneinträge mehr. Bestehende Links `/vehicles/companies` und `/inventory/companies` leiten für berechtigte Benutzer auf die zentrale Seite weiter. Personal und Kunden haben weder Menü- noch Seitenzugriff auf die Firmenverwaltung.
- Jede gespeicherte Firma hat ein Drei-Punkte-Menü mit Details, Bearbeiten und Löschen. Details öffnen `/maintenance-companies/[id]`; Bearbeiten befüllt dasselbe Formular, Löschen erfordert eine Bestätigung. Das Menü unterstützt Tastatur, Escape und Fokus-Rückgabe und bleibt auf kleinen Bildschirmen innerhalb der Seitenbreite. Bereits gespeicherte Termine behalten ihre historischen Firmen-/Adressdaten auch nach Änderung oder Löschung der Firma.
- Ein Termin gehört genau einem Mangel. Er erscheint am Mangel, am zugehörigen Fahrzeug/Medizinprodukt und gelb im Kalender. Der Kalenderlink öffnet den passenden Zeitraum; der Kalendereintrag führt zurück zum Mangel.
- PDF, CSV, ICS und Webcal verwenden dieselbe rollenabhängige Kalender-Datenquelle.
- Anlegen oder Verschieben verändert weder den Mangelstatus noch die Einsatzbereitschaft automatisch.
- Löschen des Mangels bzw. des Fahrzeugs/Inventarartikels entfernt zugehörige Termine per Fremdschlüssel-Kaskade. Löschen einer Firma erhält den Termin samt gespeichertem Firmennamen und Ort.
- Zeitpunkte werden mit Zeitzone übertragen; die Formulare zeigen lokale Eingaben. Ungültige Daten und ein Ende vor/gleich Beginn werden abgewiesen.

## Implementierung

Migration: `drizzle/0058_defect_appointments.sql`. Gemeinsame API: `/api/defect-appointments`, Änderungs-/Löschroute: `/api/defect-appointments/[id]`. Gemeinsame Oberfläche: `DefectAppointmentsPanel`. Initiale Terminlisten werden serverseitig mitgeliefert; Firmen werden auf der MP-Detailseite erst beim Bearbeiten geladen. Keine externe Zeitsteuerung erforderlich.

Die zentrale Firmen-API liegt unter `/api/maintenance-companies` (Liste/Anlegen) und `/api/maintenance-companies/[id]` (Details/Bearbeiten/Löschen). `/api/vehicles/companies` bleibt für bestehende Wartungsformulare kompatibel. Alle Schreibzugriffe sind serverseitig auf Admins und Verwaltung beschränkt; Pflichtfelder, Feldlängen, E-Mail und eindeutige Firmennamen werden geprüft. Die Änderung von Firmendaten überschreibt keine historischen Terminsnapshots.

## Prüfen

- `npm run test:defect-appointments:ui`: gemeinsames Formular, Validierung, Firmenauswahl, Zeitzone, Bearbeiten/Löschen, Leserechte und mobile Breiten.
- `npm run test:companies:ui`: Drei-Punkte-Menü, Detail-Link, Bearbeiten, Fehlererhalt, Abbrechen, bestätigtes Löschen, Tastatur/Fokus und mobile Breiten.
- `npm run test:system:production`: isolierte Datenbank, Rollen, beide Mangelarten, Detailseiten, Kalender/Exporte, Verschieben/Löschen, Kaskaden und Browserabläufe.
- `npx tsc --noEmit`, `npm run lint`, `npm run check:schema`, `npm run check:text`.

Verifiziert am 18.10.2026: Produktionsbuild erfolgreich; Gesamttest mit 39 Prüfungen und 151 Seitenaufrufen ohne Fehler. Die separaten Firmen-, Mangeltermin-, Navigations-, UI- und Performance-UI-Tests sind ebenfalls bestanden. Die Integrations- und Browsertests verwenden eine separate Testdatenbank.
