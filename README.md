# Vault (PWA)

Persönliches Finanz-Dashboard: Einnahmen, Fixkosten, Kredite und Investments mit Live-Kursen.
Installierbar als App auf Android (Pixel), iPhone und Desktop. Keine Domain, kein Backend, keine Kosten.

## Deployment auf GitHub Pages (einmalig, ~10 Minuten)

1. Auf github.com ein neues **öffentliches** Repository anlegen, z. B. `Vault` (ohne README/Lizenz initialisieren).
2. Diesen Projektordner entpacken und im Terminal (MacBook) pushen:

   ```bash
   cd Vault
   git init
   git add .
   git commit -m "Vault PWA"
   git branch -M main
   git remote add origin https://github.com/DEIN-USERNAME/Vault.git
   git push -u origin main
   ```

3. Im Repo: **Settings → Pages → Source: "GitHub Actions"** auswählen.
4. Der mitgelieferte Workflow (`.github/workflows/deploy.yml`) baut und deployt automatisch bei jedem Push.
   Fortschritt unter dem Tab **Actions** verfolgen (~1–2 Minuten).
5. Die App ist danach erreichbar unter:
   `https://DEIN-USERNAME.github.io/Vault/`

## Installation auf dem Pixel

1. Die URL in **Chrome** auf dem Pixel öffnen.
2. Menü (⋮) → **„App installieren"** (bzw. „Zum Startbildschirm hinzufügen").
3. Bestätigen – das Icon landet auf dem Homescreen und die App startet im Vollbild ohne Browser-UI.

## Live-Kurse

- **Krypto**: läuft sofort, kostenlos über CoinGecko (kein Key nötig), Kurse direkt in EUR.
- **Aktien/ETFs (US)**: kostenloser API-Key auf [finnhub.io](https://finnhub.io), in der App unter **Profil → Einstellungen** eintragen.
- **Europäische Wertpapiere, Kurshistorie, Öl**: kostenloser Key auf [twelvedata.com](https://twelvedata.com) (8 Requests/Min im Free-Tier).
- **Edelmetalle**: gold-api.com, ohne Key. Umrechnung über frankfurter.dev (Fallback open.er-api.com).

## Daten & Backup

- Alle Daten liegen **ausschliesslich lokal** im Browser-Speicher des Geräts – kein Server, kein Konto.
- **Geräte-Wechsel/Zweitgerät**: Im Profil „Backup exportieren" (JSON-Datei), auf dem anderen Gerät
  „Backup importieren". Das Backup enthält alle Einträge, das Steuerprofil und die Einstellungen
  (API-Keys optional; die App-Sperre bleibt gerätegebunden). Kein automatischer Sync.
- Kurshistorie liegt in IndexedDB und wird bei Bedarf neu geladen – sie ist nicht Teil des Backups.
- Achtung: Das Löschen der Browserdaten von Chrome löscht auch die App-Daten → regelmässig exportieren.

## Lokal entwickeln

```bash
npm install
npm run dev      # Entwicklungsserver
npm run lint     # ESLint
npm test         # Vitest (Finanzmathematik, Steuer, Parser, Backup)
npm run build    # Produktions-Build nach dist/
npm run check    # alles zusammen – läuft auch in der CI vor jedem Deploy
```

## Struktur

```
src/
  App.jsx              Haupt-Komponente (Tabs, Zustand, Sheets)
  main.jsx             Einstieg, Service-Worker-Registrierung, Fonts
  styles.css           Stylesheet (Tokens in .fc-root / .fc-root.dark)
  lib/                 reine Logik, ohne React
    finance.js         FIFO, Tilgung, Gruppen, Immobilienwert
    tax.js             § 32a EStG 2026, Soli, Objektanalyse
    currency.js        Formatierung, Betrags-Parser
    api.js             CoinGecko, Finnhub, Twelve Data, FX, Logos
    storage.js         localStorage, IndexedDB, Backup-Schema
    auth.js            WebAuthn-App-Sperre
  components/          UI-Bausteine und Formulare
  features/            lazy geladene Sheets (Chart, Tilgungsplan, Prognose, Objekt-Check)
test/                  Vitest
public/sw.js           Service Worker
```
