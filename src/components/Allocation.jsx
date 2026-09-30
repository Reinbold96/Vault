import React, { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { MASK } from "../lib/constants.jsx";
import { eur } from "../lib/currency.js";
import { allocation } from "../lib/allocation.js";
import { Card, Seg } from "./ui.jsx";

const DIMS = [
  { id: "type", label: "Art" },
  { id: "ccy", label: "Währung" },
  { id: "region", label: "Region" },
];

/* Aufteilung des offenen Portfolios als gestapelter Balken + Liste.
   Balken: feste Reihenfolge der Einträge (Farbe folgt dem Eintrag) · Liste: nach Grösse,
   mit Betrag und Anteil – die Liste ist zugleich die Tabellen-Ansicht zum Balken. */
export function AllocationCard({ groups, hist, cur, dim = "type", onDim, open = false, onToggle, masked }) {
  const a = useMemo(() => allocation(groups, dim, { hist, cur }), [groups, dim, hist, cur]);
  const unknown = a.rows.find((r) => r.id === "?");
  return (
    <Card>
      <div className="fc-alloc-head">
        <span className="t">Aufteilung</span>
        <Seg options={DIMS} value={dim} onChange={onDim} label="Aufteilung nach" className="fc-seg-mini" />
      </div>
      {a.total <= 0 ? (
        <div className="fc-detail-note">{dim === "region" ? "Noch keine Aktien oder ETFs im Bestand." : "Noch keine Positionen mit Wert."}</div>
      ) : (
        <>
          <button type="button" className="fc-flowtoggle" onClick={onToggle} aria-expanded={open} aria-label={open ? "Aufteilung einklappen" : "Aufteilung aufklappen"}>
            <div className="fc-flowbar" role="img" aria-label={a.rows.map((r) => `${r.label} ${Math.round(r.pct)} %`).join(", ")}>
              {a.bar.map((s) => (
                <div key={s.id} title={`${s.label}: ${Math.round(s.pct)} %`} style={{ width: `${s.pct}%`, background: s.color }} />
              ))}
            </div>
            <span className={`fc-flowchev ${open ? "open" : ""}`}><ChevronDown size={16} strokeWidth={2} /></span>
          </button>
          {!open && (
            <div className="fc-alloc-legend">
              {a.rows.slice(0, 3).map((r) => (
                <span key={r.id}><i style={{ background: r.color }} />{r.label} {r.pct < 1 ? "<1" : Math.round(r.pct)} %</span>
              ))}
              {a.rows.length > 3 && <span className="more">+{a.rows.length - 3}</span>}
            </div>
          )}
          {open && (
            <div className="fc-flowlist">
              {a.rows.map((r) => (
                <div className="fc-flowrow" key={r.id}>
                  <span className="dot" style={{ background: r.color }} />
                  <span className="lbl">{r.label}</span>
                  <span className="track"><span className="fill" style={{ width: `${Math.max(2, r.pct)}%`, background: r.color }} /></span>
                  <span className="amt">{masked ? MASK : eur(r.value)}</span>
                  <span className="pct">{r.pct < 1 ? "<1" : Math.round(r.pct)} %</span>
                </div>
              ))}
              <div className="fc-detail-note" style={{ marginTop: 8 }}>
                {dim === "type" && "Offene Positionen inklusive Cash – Immobilien nur mit Chart-Häkchen."}
                {dim === "ccy" && "Handelswährung der Notierung – bei ETFs nicht die Währungen der enthaltenen Firmen. Krypto ist eigene Klasse."}
                {dim === "region" && <>Nur Aktien und ETFs{a.excluded ? ` (${a.excluded} ${a.excluded === 1 ? "andere Position" : "andere Positionen"} ausgenommen)` : ""}. Einzelaktien nach Firmensitz (ISIN), ETFs nach Indexname.</>}
                {unknown && dim === "region" && <> {unknown.count} {unknown.count === 1 ? "Position ist" : "Positionen sind"} noch nicht zugeordnet – Region in der Position unter „Bearbeiten“ festlegen.</>}
                {unknown && dim === "ccy" && " Unbekannt: noch kein Kursabruf – nach dem nächsten Aktualisieren zugeordnet."}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
