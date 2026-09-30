import React from "react";
import { DATA_KEY, SETTINGS_KEY } from "../lib/storage.js";

/* ---------- Fehlergrenze ----------
   Fällt ein Teil der App aus (z. B. ein nachgeladener Chart-Baustein offline nicht
   erreichbar), zeigt nur dieser Bereich einen Hinweis – statt einer weissen Seite. */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { if (typeof console !== "undefined") console.error(err); }
  render() {
    if (!this.state.err) return this.props.children;
    if (this.props.fallback) return this.props.fallback({ retry: () => this.setState({ err: null }) });
    return (
      <div className="fc-card fc-errbox" role="alert">
        <div className="t">{this.props.label || "Dieser Bereich"} konnte nicht geladen werden.</div>
        <div className="s">Meist fehlt kurz die Verbindung. Deine Daten sind davon nicht betroffen.</div>
        <button type="button" className="fc-chip" onClick={() => window.location.reload()}>Neu laden</button>
      </div>
    );
  }
}

/* Letzte Rettung für die ganze App: neu laden oder die Rohdaten sichern */
export function downloadRawBackup() {
  try {
    const data = JSON.parse(localStorage.getItem(DATA_KEY) || "{}");
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    delete settings.lockEnabled; delete settings.lockCredId; delete settings.finnhubKey; delete settings.tdKey;
    const blob = new Blob([JSON.stringify({ vault: 5, exportedAt: new Date().toISOString(), data, settings }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vault-notfall-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch { /* nichts zu sichern */ }
}

export const AppCrash = () => (
  <div className="fc-crash" role="alert">
    <div className="t">Vault ist auf einen Fehler gestossen</div>
    <div className="s">Deine Daten liegen weiterhin auf diesem Gerät. Meist hilft neu laden – zur Sicherheit kannst du vorher ein Backup ziehen.</div>
    <button type="button" className="b1" onClick={() => window.location.reload()}>Neu laden</button>
    <button type="button" className="b2" onClick={downloadRawBackup}>Backup sichern</button>
  </div>
);

/* Nachgeladene Bausteine: bei einem Netzfehler einmal kurz warten und erneut versuchen */
export const lazyRetry = (factory) => React.lazy(() => factory().catch(() => new Promise((r) => setTimeout(r, 900)).then(factory)));
