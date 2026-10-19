# Nachrichten und Upload-Vorschau

Stand: 18.10.2026

## Nachricht senden

Unter **Team & Personal → Nachricht senden** (`/messages`). Menü, Seiten, Versand-APIs und Anhangabruf sind auf Admins und Verwaltung beschränkt.

- Eine gemeinsame Empfängerauswahl wird auch in den Einstellungen für Kontaktanfragen und Dokumentenablauf verwendet: Rollen, Benutzer und zusätzliche Adressen. Benutzer lassen sich trotz gewählter Rolle einzeln abwählen. Rollen-/Benutzerauswahl und Adressen werden zusammengeführt und beim Nachrichtenversand nach normalisierter E-Mail-Adresse dedupliziert.
- Die Nachrichtenseite bietet zusätzlich **Qualifikation**: SAN, RH, RS, RA, NFS und Ausbilder. Verglichen wird exakt mit den hinterlegten Profilwerten, nicht mit der Dienst-Zulassungshierarchie. Die Ausbildungsqualifikation zählt auch bei gleichzeitig vorhandener Rettungsdienstqualifikation. Qualifikationen lassen sich mit Rollen, Benutzern und Adressen kombinieren; die gleiche Prüfung und Deduplizierung gilt in der Vorschau und im Backend. Einzelne Benutzer können auch aus überlappenden Gruppen abgewählt werden. Ältere Nachrichten ohne Qualifikationsauswahl bleiben kompatibel; es ist keine Datenbankmigration erforderlich.
- Einheitliche Auswahlkarten und systemübliche Felder/Buttons; mobil zweispaltige Empfänger-Tabs, auf größeren Breiten vier Tabs nebeneinander. Der Versandbereich liegt auf breiten Bildschirmen neben dem Nachrichtenformular, mobil darunter. Dateiauswahl mit deutschem, systemeigenem Button statt Browser-Dateifeldbeschriftung.
- Betreff und Textinhalt, bis zu zehn Anhänge (10 MB je Datei, 20 MB insgesamt). Vorschau und Entfernen vor dem Absenden. Empfängeradressen werden für die geplante Nachricht zum Erstellungszeitpunkt gespeichert; Benutzer ohne gültige Mailadresse werden übersprungen.
- Sofortversand oder Datum/Uhrzeit in der lokalen Browserzeitzone. Die Anzeige der gespeicherten Versanddetails erfolgt in Europe/Berlin. Jede Sendung muss bestätigt werden.
- Versand einzeln je Empfänger, damit keine fremden Adressen offengelegt werden. Nachrichten nutzen die vorhandenen SMTP-Einstellungen und das gemeinsame E-Mail-Layout. Ohne aktivierte, vollständige SMTP-Konfiguration wird keine neue Nachricht angenommen.
- Versandübersicht der letzten 50 Nachrichten, Detailseiten mit paginierten Empfängerstatus und geschütztem Anhangabruf. Geplante/noch nicht gestartete Sendungen können abgebrochen werden. Sicher fehlgeschlagene Zustellungen lassen sich separat erneut anstoßen; bereits bestätigte Zustellungen werden nicht wiederholt.

## Interner Scheduler

Migration `0057_message_outbox.sql` speichert Auftrag, Empfängerzustellungen und Anhänge dauerhaft in SQLite. Der Scheduler startet über die Node-Instrumentierung, prüft alle 15 Sekunden und wird nach dem Einreichen einer Nachricht zusätzlich geweckt. Keine Browser-Timer für den eigentlichen Versand, keine externe Cron-URL und kein externer Cronjob. Fenster und Browser dürfen geschlossen werden.

Voraussetzung ist ein **dauerhaft laufender Node-Anwendungsprozess**. Ein abgeschalteter oder vom Hosting pausierter Prozess kann nicht senden. Beim Wiederanlauf werden überfällige Aufträge nachgeholt. Große Warteschlangen und langsame Mailserver können den Versand verzögern. Bei Hosting mit Idle-Abschaltung muss der Prozess entsprechend dauerhaft betrieben werden.

Eine SQLite-Transaktion beansprucht jede Zustellung vor dem Mailversand, auch bei mehreren Prozessen. Wiederholte Formularübermittlung mit derselben Kennung erzeugt keinen weiteren Auftrag. Ein Prozessabbruch nach möglicher SMTP-Annahme ist technisch nicht eindeutig rekonstruierbar: Nach Ablauf der fünfminütigen Zustellungsreservierung wird die Zustellung als **Versandstatus unklar** markiert und nicht automatisch wiederholt. Der Mailausgang muss dann geprüft werden. SMTP-Annahme bedeutet außerdem nicht, dass eine Mail tatsächlich im Empfängerpostfach oder außerhalb des Spamordners ankommt.

## Uploads

Gemeinsame Datei-Komponenten zeigen Rasterbilder, PDF-Vorschau bzw. Vorschau-Link, einen begrenzten Text-/CSV-Ausschnitt oder Dateimetadaten für andere Formate. Jede ausgewählte Datei kann einzeln entfernt und anschließend erneut ausgewählt werden. Browser-Vorschau-URLs werden beim Entfernen freigegeben. Fremde HTML-/SVG-Inhalte werden nicht als aktive Vorschau eingebettet.

Abgedeckt: Nachrichtanhänge, Fahrzeug- und Inventarmängel, Dokument-Upload, Personalfragebögen, Mitglieder-CSV-Import und Blog-Uploads (Titelbild, Bildersetzung, Inline-Bilder, Mediathek). Blogdateien werden zunächst ausgewählt und geprüft, erst nach zusätzlichem Upload-Klick übertragen. Das Entfernen eines Bildblocks oder Titelbilds entfernt die Verwendung im Beitrag, nicht ungeprüft eine möglicherweise anderweitig verwendete Datei aus der gemeinsamen Mediathek.

Gespeicherte Dokumente besitzen Vorschau-/Download-/Löschaktionen. Löschen dürfen nur Eigentümer sowie Admins/Verwaltung. Gespeicherte Mangelbilder lassen sich ausschließlich durch Admins/Verwaltung löschen; beide Mangelbereiche nutzen dieselbe atomare Logik mit Schutz vor veralteter Bildauswahl. Bereits zugestellte E-Mail-Anhänge können nicht aus Empfängerpostfächern zurückgerufen werden.

## Prüfung

```powershell
npm run test:messages
npm run test:uploads
npm run test:ui
npm run test:navigation
npm run test:blog-editor
npm run test:performance:ui
npm run test:system:production
npm run check:schema
npm run check:text
```

Der Integrationstest verwendet einen lokalen SMTP-Testserver und eine isolierte temporäre Datenbank; es werden keine echten E-Mails verschickt. Getestet werden unter anderem Versand samt binärem Anhang, Empfängerdeduplizierung, Rechte, Auftragskennung, Neustart-Nachholung, parallele Zustellungsreservierung, Abbrechen, Teilfehler, Wiederholen, unklare Zustellungen, Auswahl/Vorschau/Entfernen und Mobilbreiten 320/375/768/1280.

Abschlussergebnis einschließlich Qualifikationsgruppen: Produktionsbuild und Typprüfung erfolgreich. 145 Seitenprüfungen und 29 Funktionsprüfungen ohne Fehler; Nachrichten-, Upload-, Komponenten-, Navigations-, Performance- und Editortests bestanden. Lint: 0 Fehler, 57 bestehende Hinweise. Schema- und Daten-Textprüfung: keine Abweichungen. Lokaler Bericht: `artifacts/ui-audit-production/report.json`. Screenshot der echten mobilen Nachrichtenseite: `artifacts/ui-audit-production/messages-qualifications-mobile.png`.
