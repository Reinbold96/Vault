# Changelog

## 1.5.1 – 2026-09-02

- **Portfolio-Chart zeigte nur Positionen mit Kurshistorie.** Aktien/ETFs ohne Twelve-Data-Key (oder ohne verfügbare Historie) fielen aus dem Chart-Wert heraus – die Kopfzeile zeigte z. B. 7 308 € bei 13 076 € Portfoliowert. Solche Positionen zählen jetzt mit ihrem aktuellen Kurs als konstanter Wert; in die %-Kurve gehen sie nicht ein. Ein Hinweis unter dem Chart nennt die betroffenen Positionen.

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
