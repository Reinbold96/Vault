# Changelog

## 1.8.0 – 2026-09-30

### Investments
- **Sparpläne:** für jede Aktie, jeden ETF, Krypto oder Rohstoff einrichtbar (Betrag, Intervall von monatlich bis jährlich, erste Ausführung, optional Gebühr und Enddatum) – oder direkt beim Anlegen einer neuen Position („Einmalkauf | Sparplan“). Jede Ausführung wird als eigener Kauf mit dem Kurs des Tages gebucht; verpasste Termine trägt die App beim nächsten Öffnen nach. Liegt kein historischer Kurs vor, wird der aktuelle genommen und der Kauf als „Kurs geschätzt“ markiert – sobald die Kurshistorie da ist, rechnet die App ihn nach. In der Position: Sparplan-Karte mit nächster Ausführung, Anzahl Ausführungen und Ø Kaufkurs, Pausieren/Fortsetzen, Bearbeiten, Löschen (Käufe bleiben). In der Liste steht ein „Sparplan“-Hinweis; Pläne einer neuen Position erscheinen bis zur ersten Ausführung unter „Wartende Sparpläne“. Mehrere Sparpläne je Position sind möglich.
- **CSV-Import** von Trade Republic („Transaktionsexport“), Scalable Capital und anderen Brokern (Spalten wie Datum, Typ, ISIN, Stück, Kurs, Betrag). Vorschau mit Käufen, Verkäufen, Ausschüttungen, übersprungenen Zeilen und Dubletten; Spalten lassen sich prüfen und umstellen; zu neuen ISINs wird der Ticker automatisch gesucht. Gebühren fliessen in den Kaufkurs, Steuern auf Ausschüttungen werden gemerkt. Bereits vorhandene Buchungen werden erkannt, geschätzte Sparplan-Käufe durch die echten Ausführungen ersetzt. Optional: Erlöse und Ausschüttungen aufs Cash-Konto. Mit Rückgängig.
- **Aufteilung** (Art, Währung, Region) als Balken mit Liste unter dem Chart, dazu der **Anteil** jeder Position in der Liste. Regionen: Einzelaktien nach Firmensitz (ISIN), ETFs nach Indexname, beides in der Position überschreibbar.
- **Position bearbeiten:** Name, Kennung (Ticker ↔ ISIN ↔ WKN), Börse, Region, Logo und Chart-Häkchen für alle Käufe auf einmal. Verkäufe, Ausschüttungen und Sparplan ziehen bei neuer Kennung mit; der Kurs wird sofort neu geholt.
- **Verkäufe bearbeiten:** antippen, Menge/Kurs/Datum ändern – die Buchung auf dem Cash-Konto passt sich an.
- **Vergleichsindizes in deiner Währung:** S&P 500, Nasdaq, World und DAX werden taggenau in EUR/CHF umgerechnet – der Vergleich enthält jetzt denselben Währungseffekt wie dein Depot.
- Immobilien ohne Häkchen „Im Verlaufs-Chart und in der Performance berücksichtigen“ zählen nicht mehr zur Performance (und nicht zur Aufteilung) – z. B. das selbst bewohnte Eigenheim. Zum Vermögen zählen sie weiter.

### Behoben
- Beim Öffnen eines Eintrags (Kosten, Einnahmen, Positionen …) springt die Tastatur nicht mehr auf: kein Feld wird automatisch ausgewählt – überall in der App.
- Das Häkchen am Ende eines Formulars (z. B. „Im Verlaufs-Chart anzeigen“ bei Immobilien) war vom Übergang über dem Speichern-Button halb verdeckt. Der Übergang erscheint jetzt nur noch, solange darunter weiterer Inhalt folgt.
- Maskierte Beträge bleiben auch in Positions-, Verkaufs- und Cash-Details verborgen.
- **Währungswechsel** rechnet jetzt um: Die App fragt beim Umstellen, ob Kaufkurse, Verkäufe, Ausschüttungen, Kredite, Sparziele und Sparpläne zum aktuellen Kurs umgerechnet werden sollen (Renditen bleiben gleich). Einnahmen, Kosten und Cash-Konten behalten ihre bisherige Währung und werden live umgerechnet. Mit Rückgängig.
- Ausschüttungen: optional die **einbehaltene Steuer** erfassen – der Sparerpauschbetrag zählt die Ausschüttung dann brutto.
- Kurse in Pence (London, „GBp“) sowie Rand-Cent und Agorot werden korrekt in die Hauptwährung umgerechnet.
- Backups enthalten die API-Keys nur noch, wenn das Häkchen gesetzt ist (Standard: aus).

### Technik
- App.jsx aufgeräumt: Kursabruf (lib/prices.js), Buchungen inkl. Cash-Konto (lib/booking.js), Vermögensverlauf (lib/wealth.js) und Chart-Berechnung (lib/portfolioSeries.js) sind eigene, getestete Module; 127 Tests.
- Vermögensverlauf wird nur noch bei geänderten Daten berechnet, nicht bei jedem Tastendruck; die Chart-Berechnung nutzt eine FIFO-Zeitleiste statt FIFO pro Tag und Position.
- Die Chart-Bibliothek liegt nicht mehr auf dem Startpfad: Zahlen und Listen erscheinen sofort, Diagramme laden einen Moment später.
- Kurshistorie wird täglich nur noch ergänzt statt komplett neu geladen und je Serie gespeichert (statt als ein grosser Block).
- Fehlergrenzen: Fällt ein nachgeladener Baustein aus (z. B. offline), zeigt nur dieser Bereich einen Hinweis; bei einem schweren Fehler gibt es „Neu laden“ und „Backup sichern“ statt einer weissen Seite.
- Barrierefreiheit: Umschalter mit aria-pressed, Tab-Leiste mit aria-current, Käufe/Verkäufe als echte Buttons; Sheets setzen den Fokus nicht mehr bei jedem Render zurück. Keine Lint-Warnungen mehr.

## 1.7.0 – 2026-09-29

### Aktien und ETFs per ISIN oder WKN
- Im Formular für Aktien und ETFs gibt es neben **Ticker** jetzt **ISIN** und **WKN**. Die App sucht das Wertpapier (onvista, Twelve Data – beides ohne API-Key), füllt Name und Typ aus und zeigt die Handelsplätze zur Auswahl („Kurse über ASST · NASDAQ · USD“).
- Gerechnet wird weiter mit dem Ticker; ISIN, WKN und Börse werden mitgespeichert und in der Positions-Ansicht angezeigt. Eine ISIN im Ticker-Feld wird automatisch erkannt.
- Tippfehler fallen sofort auf (ISIN-Prüfziffer, WKN ohne I/O). Wird nichts gefunden, bleibt die Kennung gespeichert und der Ticker lässt sich von Hand eintragen.
- Kurse: Bei gewählter europäischer Notierung fragt die App nicht mehr Finnhub (US), sondern Twelve Data mit dem passenden Handelsplatz.

### Gekündigte Verträge
- Fixkosten haben einen Status **Läuft / Gekündigt**. Bei „Gekündigt“: gekündigt am, Vertrag endet am (Vorschlag aus Laufzeit und Frist) und **Kündigungsbestätigung erhalten**.
- Übersicht → **Verträge**: fällige Kündigungen, gekündigte Verträge (mit Restlaufzeit, „Bestätigung fehlt“) und beendete Verträge, klar unterschieden. Oben rechts steht, wie viel die gekündigten Verträge monatlich sparen.
- Schnellaktionen direkt auf der Übersicht: **Gekündigt** (aus der Erinnerung), **Bestätigt**, nach Ablauf **Entfernen** oder **Behalten** – jeweils mit Rückgängig.
- Nach dem letzten Vertragstag zählt ein gekündigter Vertrag nicht mehr zu Fixkosten, Ring und Überschuss; in der Liste steht er durchgestrichen als „Beendet“.
- Der bisherige Link „Gekündigt – endet am …“ ist durch den Status ersetzt.

### Ruhigeres Aktualisieren der Kurse
- Kein Statusbalken mehr oben. Während eines Abrufs bleiben die bisherigen Kurse stehen; neue Werte blenden sich sanft ein.
- **Weniger Abrufe:** Beim Öffnen/Neuladen wird nur abgerufen, wenn der letzte Stand älter als 5 Minuten ist. Herunterziehen innerhalb einer Minute nach dem letzten Abruf fragt die Kursdienste nicht erneut (kurzer Spinner als Rückmeldung). Wechselkurse werden höchstens stündlich geholt.
- Automatische Abrufe laufen still im Hintergrund – im Invest-Reiter steht dezent „Kurse werden aktualisiert …“. Der Spinner oben erscheint nur beim Herunterziehen.
- Probleme kommen einmal am Ende als kurzer Hinweis unten (ca. 4 Sek., antippen schliesst), ohne Dienstnamen – z. B. „Kurse konnten gerade nicht aktualisiert werden – angezeigt wird der Stand von vor 2 Std.“ Automatische Abrufe melden sich nur, wenn gar nichts ging.
- **Portfolio-Chart:** zeichnet sofort aus dem Zwischenspeicher (auch vom Vortag) und lädt fehlende Kursverläufe im Hintergrund nach (kleines Sync-Symbol). Kein „Kursverlauf wird geladen …“ mehr beim Tab-Wechsel; Netzfehler bei vorhandenen Daten bleiben still.

### Portfolio-Chart
- Die grauen Verkaufsmarker und der Hinweis darunter sind wieder entfernt. Verkaufte Positionen zählen weiter in Kurve und Performance.

## 1.6.0 – 2026-09-29

### Immobilienkredit in den Fixkosten
- Kredite haben jetzt eine **Art** (Immobilien-, Auto-, Ratenkredit, Sonstiges). Bestehende Kredite werden am Namen erkannt („Immobilienkredit“, „Baufinanzierung“, „Haus“ …), die Art lässt sich beim Bearbeiten festlegen.
- Die Monatsrate eines Immobilienkredits steht unter **Fixkosten → Wohnen** – nicht editierbar, mit Pfeil; Antippen springt direkt in den Kredit.
- Sie zählt zu Fixkosten, Gesamtkosten und zur Kategorie Wohnen im Ausgaben-Ring. In der Cashflow-Leiste erscheint sie nicht mehr zusätzlich unter „Kredite“ – der Überschuss bleibt exakt gleich.

### Kündigungserinnerungen
- Neues Häkchen **„Auf der Übersicht an die Kündigung erinnern“** – nur damit erscheint ein Vertrag auf der Übersicht. Der Hinweis in der Fixkosten-Liste bleibt unabhängig davon.
- **Automatische Verlängerung** (12/24/6/3 Monate, monatlich oder keine): Ist die Laufzeit vorbei, rechnet die App mit der nächsten Laufzeit weiter, statt dauerhaft „Frist verstrichen“ zu zeigen.
- Kündigungsfrist in **Monaten, Wochen oder Tagen**; Vorschau im Formular („Kündigen bis … · Laufzeit endet …“).
- „Gekündigt – endet am …“ stellt den Vertrag auf „endet“ und schaltet die Erinnerung ab.
- Behoben: Fristen an Monatsenden lagen bis zu 3 Tage zu spät (31.05. − 3 Monate ergab 02.03. statt 28.02.), Datumsrechnung war zeitzonenabhängig, „Öffnen“ auf der Übersicht schrieb Hilfsfelder in den Eintrag, der Hinweis unter der Karte galt nur für den ersten Vertrag.
- Backup enthält die neuen Felder (Verlängerung, Frist-Einheit, Erinnerung, Kreditart, Intervall, Währung, ausgeblendete Positionen).

### Fixkosten: Intervalle, Währung, Kategorien
- Neue Intervalle **quartalsweise** und **halbjährlich** (z. B. Grundsteuer, Rundfunkbeitrag, Versicherungen) – umgerechnet auf den Monat.
- **Eigene Währung pro Posten** (EUR/USD/CHF) für Fixkosten, variable Kosten, Sparraten und Einnahmen – z. B. Lohn oder Krankenkasse in CHF. Summen, Ring, Cashflow und Überschuss rechnen zum aktuellen Kurs in der Anzeigewährung; die Liste zeigt zusätzlich den Originalbetrag. Die letzten Kurse werden gemerkt, damit offline nicht 1:1 gerechnet wird.
- Neue Kategorien **Energie**, **Kommunikation** und **Steuern & Abgaben**. Bestehende Einträge bleiben in ihrer Kategorie.

### Verkaufte Positionen bleiben in der Performance
- Invest-Tab: vollständig verkaufte Positionen stehen in einem eigenen Bereich **„Abgeschlossen“** (mit realisiertem Gewinn, Rendite in %, Haltedauer) statt zwischen den offenen Positionen. Sie lassen sich **ausblenden** – die Performance zählt sie weiter.
- **Trade-Karte** je verkaufter Position: Kursverlauf mit Kauf ▲ und Verkauf ▼, Haltephase hinterlegt, Einstand/Erlös/Gewinn/Rendite/p. a./Haltedauer und **„Seit Verkauf“** (was wäre die Position heute wert). „Wieder kaufen“ holt sie zurück; „Endgültig löschen“ ist bewusst nur noch hier.
- Kachel **„Performance“** = offene Kursgewinne + realisierte Gewinne + Ausschüttungen (vorher ohne Ausschüttungen). Antippen öffnet die **Performance-Bilanz**: je Jahr oder gesamt, Aufteilung offen/realisiert/Ausschüttungen, **Sparerpauschbetrag** (1 000 € bzw. 2 000 € mit Splitting laut Profil; vereinfacht, ohne Krypto/Edelmetalle) und Top & Flop inkl. verkaufter Positionen.
- Portfolio-Chart: Verkäufe als Marker auf der Linie.

### Hinweis zur Umstellung
- Die Performance-Kachel steigt um die bisher gebuchten Ausschüttungen.
- Bestehende Verträge haben das Erinnerungs-Häkchen noch nicht gesetzt und erscheinen deshalb nicht mehr auf der Übersicht, bis es aktiviert wird. Alte Einträge ohne Angabe zur Verlängerung gelten als „endet“.

## 1.5.1 – 2026-09-02

- **Portfolio-Chart zeigte nur Positionen mit Kurshistorie.** Aktien/ETFs ohne Twelve-Data-Key (oder ohne verfügbare Historie) fielen aus dem Chart-Wert heraus – die Kopfzeile zeigte z. B. 7 308 € bei 13 076 € Portfoliowert. Solche Positionen zählen jetzt mit ihrem aktuellen Kurs als konstanter Wert; in die %-Kurve gehen sie nicht ein. Ein Hinweis unter dem Chart nennt die betroffenen Positionen.
- Profil: jedes API-Key-Feld hat jetzt ein eigenes Auge – Finnhub und Twelve Data lassen sich getrennt ein- und ausblenden.

## 1.5.0 – 2026-09-02

Grosses Wartungs-Release nach Code-Review (23 Findings). Keine Datenmigration nötig – bestehende Daten, Einstellungen und Backups werden weiter gelesen.

### Behoben (Korrektheit)
- **Einkommensteuertarif** war ein Mix aus Tarifjahren und sprang an den Zonengrenzen (+132 € / −518 €). Jetzt § 32a EStG i. d. F. ab VZ 2026, Soli-Freigrenze 20 350 / 40 700 €, Kinderfreibetrag 9 756 € – mit Stetigkeitstest.
- **Betragsfeld**: „0.123“ wurde zu 123 (Tausenderpunkt-Regex). Punkt gilt nur noch als Tausendertrenner, wenn ein Komma vorkommt oder mehrere Gruppen da sind.
- **Kursrundung**: Micro-Cap-Kurse (< 0,0001) wurden auf 0 gerundet → jetzt 8 signifikante Stellen.
- **Invest-Tab**: Kachel „Portfoliowert“ zeigte das Nettovermögen.
- **Kurs-Statusmeldungen** („Key ungültig“, „Limit erreicht“, fehlgeschlagene Ticker) wurden nie angezeigt.
- Kauf-Löschen hat jetzt Rückgängig; Zahltag 31 in kurzen Monaten wird auf den Monatsletzten gezogen; Undo verliert bei schnellen Doppel-Löschungen keinen Zustand mehr.

### Daten & Speicher
- Speichern zusätzlich sofort bei `pagehide` / Wechsel in den Hintergrund (bisher konnte die letzte Änderung in der PWA verloren gehen). Speicherfehler werden angezeigt.
- Kurshistorie liegt in **IndexedDB** statt localStorage (Quota), bestehende Historie wird automatisch migriert.
- **Backup v4**: enthält jetzt das komplette Steuerprofil (Einkommen, Währung, Splitting, Bundesland, Kirche, Kinder, Geburtsdatum) und alle Einstellungen (ohne App-Sperre). Import validiert und normalisiert jeden Eintrag – eine kaputte Datei kann die App nicht mehr unbenutzbar machen. Alte Backup-Formate (v1–v3) werden weiter gelesen. API-Keys optional im Export.
- Service Worker räumt Assets alter Builds aus dem Cache (bisher wuchs er mit jedem Deploy).

### Performance
- `ListItem` auf Modulebene (kein Remount aller Zeilen bei jedem Tastendruck), Kurshistorie nicht mehr bei jedem Render aus dem Speicher geparst.
- Code-Splitting: Chart, Tilgungsplan, Prognose und Objekt-Check laden erst beim Öffnen; React und Recharts in eigenen, lange gecachten Chunks. App-Chunk 43 KB gzip (vorher 210 KB in einem Stück).
- Kurshistorie für Aktien/ETFs/Benchmarks in **einem** Twelve-Data-Request (statt einer pro Symbol mit 0,9 s Pause).
- Inter wird selbst gehostet (offline verfügbar, kein Google-Fonts-Request).

### Privacy & Sicherheit
- Content-Security-Policy; Logo-Dienste auf zwei reduziert und abschaltbar (Profil → „Logos“).
- API-Key-Felder als Passwortfelder mit Auge; Hinweistext nennt ehrlich, welche Dienste Ticker sehen.

### Zugänglichkeit
- Sheets sind Dialoge (role, aria-modal, Escape, Fokus-Falle, Fokus-Rückgabe); Listenzeilen sind Buttons und per Tastatur bedienbar.
- Zoom ist im Browser wieder erlaubt; nur die installierte App unterdrückt Pinch-Zoom.

### Objekt-Check
- Neuer Abschnitt „Annahmen“: Mietsteigerung, Wertsteigerung, Leerstand (Standard 0 – bisher waren die Felder tot).

### Technik
- App.jsx (4 787 Zeilen) aufgeteilt in `lib/` (finance, tax, currency, api, storage, auth), `components/`, `features/`, `styles.css`.
- Vitest (41 Tests), ESLint, CI prüft Lint + Tests + Build vor dem Deploy.
- Vite 8, React 19, Recharts 3, lucide-react 1.x. Version kommt aus `package.json`.
- Root von alten Build-Artefakten bereinigt.
