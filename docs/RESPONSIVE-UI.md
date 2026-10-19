# Responsive UI – Umsetzung und Prüfprotokoll

## Gemeinsame Regeln

- Die dauerhafte Seitenleiste beginnt bei 1024 px. Darunter wird dasselbe Menü als zugänglicher Dialog geöffnet.
- Formularfelder auf Smartphones verwenden mindestens 16 px Schrift, um automatisches Eingabe-Zoomen zu vermeiden.
- Mobile Schaltflächen und Eingabefelder bieten mindestens 44 px Höhe; Auswahloptionen mindestens 48 px.
- Dropdowns verwenden überall `AppSelect`; die native Auswahl bleibt für Formulardaten und Pflichtfeldvalidierung erhalten.
- Dropdown-Positionierung berücksichtigt den sichtbaren Viewport einschließlich Bildschirmtastatur und Zoom. Die Liste erscheint über modalen Dialogen.
- Checkboxen und Radiobuttons nutzen dieselben Farben, Größen, Radien und Fokusmarkierungen. Versteckte Checkboxen mit sichtbarem Indikator sind ebenfalls vereinheitlicht.
- Kartenaktionen dürfen umbrechen. Lange Überschriften bleiben lesbar.

## Mobile Ansichten

- Mitglieder, Kunden, Dashboard-Dienste und Stunden: vertikale Datensätze statt erzwungener Desktop-Spalten.
- Stunden: Beginn und Ende erhalten in der mobilen Darstellung eigene Beschriftungen.
- Kalender: auf Smartphones Terminlisten für den gewählten Zeitraum; Raster auf größeren Bildschirmen.
- Rollen: je Aktion beschriftete Rollenfelder, ohne horizontales Tabellen-Scrollen.
- Benachrichtigungen und Gebühren: gestapelte Einstellungszeilen.
- Prowl: gestapelte Einträge und Eingabefelder.
- Kurse: flexible Kennzahlenkarten ohne doppelte Innenabstände und ohne kollidierende Statusanzeigen.
- Benachrichtigungs-Popup: Text und Aktionen auf schmalen Bildschirmen untereinander.

## Bedienungsfehler

- Logout ist für Hilfstechnologien erreichbar und besitzt eine ausreichend große Fläche.
- Bestätigungsdialoge halten den Tastaturfokus innerhalb des Dialogs.
- Fehlgeschlagene Rollenänderungen werden zurückgesetzt und verständlich gemeldet; laufende Speicherungen sperren die betroffene Auswahl.
- Deaktivierte Optionsgruppen sind im gemeinsamen Dropdown nicht auswählbar.

## Wiederholbare Prüfung

```powershell
node scripts/build-styles.mjs
node scripts/test-ui-components.mjs
node scripts/test-navigation.mjs
node scripts/test-responsive.mjs
npm run build
node scripts/test-responsive.mjs --production
```

`test-responsive.mjs` arbeitet mit einer eigenen temporären SQLite-Datenbank. Die echte Anwendungsdatenbank wird nicht verwendet. Interne Seiten werden bei 320, 390, 768, 1024 und 1440 px geprüft. Zusätzlich werden Verwaltungs-, Personal- und Kundenseiten sowie öffentliche Formulare besucht. Der Produktionsdurchlauf prüft auch die geöffnete Kursbearbeitung, Dropdowns, Navigation und Benachrichtigungen.

JSON-Ergebnisse und repräsentative Screenshots befinden sich in `artifacts/responsive-audit` und `artifacts/responsive-production`. Die Prüfung erfasst HTTP-Fehler, JavaScript-Laufzeitfehler und horizontalen Seitenüberlauf. Sie ersetzt keine Tests auf sämtlichen realen Endgeräten und erfasst nicht jede denkbare Kombination von Daten und geöffneten Dialogen.
