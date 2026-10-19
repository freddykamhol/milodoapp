# UI- und Funktionsprüfung

Stand: 18.10.2026

Ergänzende systemweite Ladezeitoptimierung und Lastmessungen: [PERFORMANCE.md](PERFORMANCE.md). Der erweiterte Systemtest umfasst jetzt 141 Seitenprüfungen und 24 Funktionsprüfungen.

## Änderungen

Navigation neu gegliedert: Planung & Einsätze; Fuhrpark & Material; Team & Personal; Verwaltung; Mein Konto. Desktop und Mobilmenü verwenden dieselbe rollenabhängige Struktur. Untermenüs sind separat aufklappbar; der aktive Bereich öffnet automatisch. Die Menüsuchfunktion berücksichtigt Unterseiten. Die Desktopnavigation ist unabhängig scrollbar; das mobile Menü besitzt feste Kopf-/Fußbereiche, Fokusbegrenzung, Hintergrundsperre und schließt bei Escape, Außenklick und Wechsel auf Desktopbreite. „Heute im Blick“ bleibt auf dem Desktop aufklappbar erreichbar.

Zusätzliche Menüprüfung: npm run test:navigation — alle vier Rollen, Suche, Untermenüs, aktive Seite, Fokus und Breiten 320/375/767/1280. Screenshots: artifacts/navigation/.

- Gemeinsame eigene Dropdowns mit Suche, Tastaturbedienung, Formularvalidierung und bildschirmbegrenzter Positionierung. Das unsichtbare Select dient ausschließlich der Formularsemantik.
- Gemeinsame Bestätigungsdialoge, Texteingaben und Rückmeldungen statt Browserdialogen; einheitliche Felder, Fokusdarstellung und Touch-Zielflächen.
- Fahrzeug- und Inventarmängel verwenden dieselben Übersichten, Anlageformulare und Detailansichten. Statusänderungen erfolgen ausschließlich auf der Detailseite durch Admins oder Verwaltung.
- Einheitliche rollenabhängige Navigation; mobil scrollbar und vollständig. Benachrichtigungen bleiben auch bei langen Inhalten innerhalb des sichtbaren Bereichs.
- Kategoriebezogene Inventarfelder und Detailanzeigen; keine Packliste. Nummernvergabe ist auch bei parallelen Anlagen eindeutig; manuelle Nummern bleiben erhalten.
- Fahrzeug-Personalzuordnung funktioniert zusätzlich ohne Drag-and-drop über Dropdown und Entfernen-Schaltfläche.
- Fehlerhafte Zeichenkodierung im Quelltext und gespeicherte fehlerhafte Stück-Einheiten korrigiert.

## Behobene Funktionsfehler

- Bestandsänderungen und Kilometerstände werden tatsächlich gespeichert und atomar aktualisiert. Parallele Entnahmen können keinen negativen Bestand erzeugen.
- Bestandskorrekturen auf null sind möglich. Mindestbestände sonstiger Artikel werden nicht mehr verworfen.
- Kunden dürfen Fahrzeug- und Inventar-APIs nicht aufrufen; Personal kann Verwaltungsaktionen nicht über direkte API-Aufrufe umgehen.
- Dienstabsagen und Rückstufungen entfernen zugehörige Abschnitts- und Fahrzeugzuordnungen, ohne andere Dienste zu verändern.
- Mehrtägige laufende Fahrzeugbelegungen werden berücksichtigt. Fahrten prüfen aktuelle Kilometerstände, eindeutige Titel und gültige Zeiträume.
- Fahrzeuglöschung führt alle zugehörigen Löschungen innerhalb einer Datenbanktransaktion aus.
- Fehlende Dokumentdateien liefern eine saubere 404-Antwort statt eines unbehandelten Serverfehlers.
- Fehlende Tabellen durch neue Migration ergänzt; vorhandene Migrationen unverändert gelassen.
- Windows-Build-Kompatibilität für falsch als `EISDIR` gemeldete Dateilink-Proben, ohne Laufzeitverhalten der Anwendung zu verändern.

## Reproduzierbare Prüfungen

Abschließendes Ergebnis: Produktionsbuild und Typprüfung erfolgreich; 141 Seitenprüfungen und 23 Funktionsprüfungen ohne Fehler. Komponenten- und Editorprüfungen bestanden. Schema- und Textprüfung melden keine Abweichungen. Lint: 0 Fehler, 57 Hinweise. Mobil geprüfte Komponentenbreiten: 320, 375, 768 und 1280 Pixel.

```powershell
npm run build
npx tsc --noEmit
npm run lint
npm run test:ui
npm run test:blog-editor
npm run test:system:production
npm run check:schema
npm run check:text
```

Der Systemtest legt eine isolierte temporäre Datenbank mit allen vier Rollen an. Er prüft öffentliche Seiten, Übersichten, Formulare und ausgewählte Datensatz-Detailseiten auf Mobil- und Desktopbreite sowie Rollenrechte, Bestands- und Fahrtenbuchlogik, Löschketten und Bedienabläufe. Er verschickt keine echten Benachrichtigungen an externe Dienste.

Maschinenlesbare Ergebnisse und Screenshots: `artifacts/ui-audit-production/`. Komponentenprüfungen: `artifacts/ui-audit/`. Die Sicherung vor den abschließenden Datenbankmigrationen liegt unter `artifacts/ui-audit/database-before-final-migrations.db` und ist nicht für Git vorgesehen.

## Abgrenzung

Browserprüfungen laufen in Chromium; echte iOS-/Android-Geräte und Safari sind damit nicht ersetzt. SMTP, SFTP, Telegram und Prowl mit produktiven Zugangsdaten sowie sämtliche möglichen Datenkonstellationen sind nicht vollständig Ende-zu-Ende getestet. Lint enthält weiterhin Hinweise, überwiegend ungenutzte Bezeichner und Bildoptimierung, jedoch keine Fehler. Die Prüfung ist kein vollständiger Sicherheits- oder Penetrationstest.
