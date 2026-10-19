# Ladezeiten und reproduzierbare Prüfung

Stand: 18.10.2026

## Systemweite Änderungen

- Anfangsdaten für Fuhrpark, Materialbestand und Materialdetails, Kalender, Kontaktanfragen und Blogeditor werden mit der Seite geladen. Die unmittelbar anschließende identische Browserabfrage entfällt.
- Gemeinsame serverseitige Lesemodelle für Seiten und APIs; keine rollenübergreifenden Nutzerdaten-Caches. Berechtigungen bleiben vor jeder Datenabfrage bestehen.
- Übersichten übertragen nur benötigte Spalten statt vollständiger Beschreibungen, Bilddaten und großer Detaildatensätze. Mitgliederabfragen lesen keine Passwort-Hashes mehr für die Übersicht.
- Große Mitglieder-, Material-, Mängel-, Kunden-, Blog- und Prüfungslisten sowie die Mitgliederwahl bei Stunden rendern seitenweise. Die Suche arbeitet vor der Seitenteilung. Die Dokumenten-Mitgliederwahl verwendet serverseitige Suche und Seitenteilung.
- Wiederverwendete Datumsformatierer, keine erneute Schemaeinrichtung bei jedem Blog-/Fragebogenaufruf, gebündelte Datenbankupdates und zusätzliche Leseindizes in Migration 0056.
- Registrierungsformulare und „Heute im Blick“ laden erst beim Öffnen. Geschlossene Menüs verursachen keine unnötigen Countdown-Neuberechnungen. Der künstliche Seiten-Einblendeffekt wurde entfernt.
- Materialdaten werden beim Zurückkehren zum Fenster nach mindestens 30 Sekunden aktualisiert. Der Fahrzeugstatus wird zusätzlich bei sichtbarer Seite regelmäßig aktualisiert. Änderungen über Formulare laden die betroffenen Daten weiterhin ausdrücklich neu.
- Sofortiges Ladefeedback beim Routenwechsel; CSS wird vor jedem Produktionsbuild automatisch neu erzeugt.

## Entwicklungsmodus ist kein Geschwindigkeitsmaßstab

`npm run dev` und `npm run dev:server` kompilieren Seiten bei Bedarf. Besonders der erste Aufruf kann deshalb deutlich länger dauern als die produktive Anwendung.

`npm run start:server` setzt jetzt ausdrücklich die Produktionsumgebung. Zuvor konnte der Befehl ohne gesetztes `NODE_ENV` unbemerkt den Entwicklungsmodus verwenden.

Schnellen lokalen Betrieb getrennt vom laufenden Entwicklungsserver starten:

```powershell
npm run preview
```

Das erzeugt einen Produktionsbuild und startet ihn auf `http://localhost:3001`. Ein anderer Port kann über `PREVIEW_PORT` gewählt werden. Alternativ: `npm run build`, danach `npm run start` oder für den eigenen Server `npm run start:server`. Vorhandene Entwicklungsprozesse werden nicht automatisch beendet.

## Messverfahren und Grenzen

`npm run benchmark:performance` startet einen isolierten Produktionsserver mit temporärer SQLite-Datenbank: 4.002 Dienste, 1.004 Materialartikel, 1.004 Benutzer und 20.001 Benachrichtigungen. Keine echten externen Benachrichtigungen. HTTP-Vergleiche verwenden fünf warme Messungen nach einem Aufwärmaufruf; die zusätzliche Routenprüfung verwendet drei warme Messungen. Die Messung erfolgt lokal ohne Netz-/CPU-Drosselung.

Browsermessungen warten auf den sichtbaren Hauptlisteninhalt und zwei Animationsframes. `contentReadyMs` misst damit nicht die vollständige Interaktionsbereitschaft. Im älteren Vorher-Bericht hieß dasselbe Feld `usableMs`. Ressourcenangaben zu diesem Zeitpunkt sind keine vollständige Transferbilanz.

`npm run test:system:production` prüft alle statischen Anwendungsseiten, repräsentative Detaildatensätze, öffentliche Seiten und Rollenwechsel. Für die Verwaltungsseiten enthält der Bericht zusätzlich TTFB, DOMContentLoaded und First Contentful Paint bei Mobil- und Desktopbreite. Das prüft den Seitenkatalog, nicht jede denkbare Datenkombination, externe SFTP-/Mail-Laufzeiten oder reale Mobilfunkbedingungen. Die gleichen Millisekundenwerte für jede Seite in jeder Umgebung werden nicht garantiert.

Ergebnisse: `artifacts/performance/before/benchmark.json`, `artifacts/performance/after/benchmark.json`, `artifacts/ui-audit-production/report.json`. Diese lokalen Artefakte und die Datenbanksicherung `artifacts/performance/database-before-indexes.db` sind nicht für Git vorgesehen.

## Messergebnis im lokalen Produktionsbuild

Lasttest: alle 57 ermittelten statischen Verwaltungsseiten und ausgewählten Detailrouten antworteten erfolgreich. Median der warmen Routenmediane: **10,3 ms**, langsamste Route: **79,1 ms** (`/vehicles/trips/new`). Gemessen wurden vollständige lokale HTTP-Antworten, nicht Ladezeiten über das Internet.

| Vergleich | Vorher | Nachher |
| --- | ---: | ---: |
| Fahrzeug-API, Median | 317,2 ms | 5,9 ms |
| Material-API, Antwortgröße | 1.686.900 Byte | 130.900 Byte |
| Mitgliederseite, HTTP-Median | 125,5 ms | 30,9 ms |
| Mitgliederseite, Antwortgröße | 1.656.026 Byte | 356.992 Byte |
| Sichtbare Materialliste, zwei Browserläufe | 300 / 299 ms | 81 / 83 ms |
| Sichtbare Mitgliederliste, zwei Browserläufe | 518 / 755 ms | 98 / 82 ms |

Die HTML-Antwort von Fahrzeug- und Materialübersicht enthält jetzt bereits echte Anfangsdaten statt nur eines Laders. Deshalb kann deren reine HTML-Antwortzeit etwas steigen, während die nutzbare Liste deutlich früher erscheint. Zwei Browserläufe dienen als Vergleich, nicht als statistische Verteilung. Ein Vorher-Vergleich wurde nur für die ausdrücklich protokollierten Vergleichsrouten erhoben, nicht nachträglich für alle 57 Routen angenommen.

Build, Komponenten-, Navigations- und Editortests erfolgreich; Lint: 0 Fehler, 57 bestehende Hinweise. Der vollständige Systemtest umfasst 141 Seitenprüfungen und 24 Funktionsprüfungen einschließlich Rollenrechten und der unterbundenen doppelten Anfangsabfragen. Schema- und Textprüfung: keine Abweichungen.

## Prüfkommandos

```powershell
npm run build
npm run lint
npm run test:performance:ui
npm run test:ui
npm run test:navigation
npm run test:blog-editor
npm run test:system:production
npm run benchmark:performance
npm run check:schema
npm run check:text
```
