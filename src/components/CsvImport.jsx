import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, ChevronDown } from "lucide-react";
import { C } from "../lib/constants.jsx";
import { fmtDay } from "../lib/currency.js";
import { readCsv, toTxns, planImport, FIELDS } from "../lib/csvImport.js";
import { resolveSecurity } from "../lib/identifiers.js";
import { Btn, CheckRow, Sub } from "./ui.jsx";

/* Datei lesen: UTF-8, bei kaputten Umlauten Windows-1252 (ältere Bank-Exporte) */
async function readText(file) {
  const buf = await file.arrayBuffer();
  const utf = new TextDecoder("utf-8").decode(buf);
  if (!utf.includes("�")) return utf;
  try { return new TextDecoder("windows-1252").decode(buf); } catch { return utf; }
}

/* ---------- CSV-Import (Trade Republic, Scalable Capital, allgemein) ---------- */
export function CsvImport({ data, cur, fxRates, onImport }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);      /* { name, parsed } */
  const [map, setMap] = useState(null);
  const [err, setErr] = useState("");
  const [resolved, setResolved] = useState({});
  const [progress, setProgress] = useState(null); /* { done, total } */
  const [toCash, setToCash] = useState(false);
  const [showMap, setShowMap] = useState(false);

  async function pick(f) {
    setErr(""); setResolved({}); setProgress(null);
    try {
      const text = await readText(f);
      const parsed = readCsv(text);
      if (!parsed.header.length || !parsed.rows.length) throw new Error("leer");
      setFile({ name: f.name, parsed });
      setMap(parsed.map);
      setShowMap(parsed.format === "CSV");
    } catch {
      setFile(null);
      setErr("Die Datei liess sich nicht lesen – bitte eine CSV-Datei aus dem Transaktions-Export wählen.");
    }
  }

  const tx = useMemo(() => (file && map ? toTxns(file.parsed.rows, map) : null), [file, map]);
  const plan = useMemo(() => (tx ? planImport(tx.txns, data, { cur, fx: fxRates, resolved }) : null), [tx, data, cur, fxRates, resolved]);

  /* Neue Wertpapiere: passenden Ticker zur ISIN suchen (nacheinander, schont die Dienste) */
  const known = useMemo(() => new Set((data.investments || []).map((x) => x.isin).filter(Boolean)), [data.investments]);
  const toResolve = useMemo(() => (tx ? [...new Set(tx.txns.filter((t) => t.isin && t.type !== "krypto" && !known.has(t.isin)).map((t) => t.isin))] : []), [tx, known]);
  const resolveKey = toResolve.join(",");
  useEffect(() => {
    if (!toResolve.length) return undefined;
    let dead = false;
    (async () => {
      setProgress({ done: 0, total: toResolve.length });
      const out = {};
      for (let i = 0; i < toResolve.length; i++) {
        if (dead) return;
        const r = await resolveSecurity("isin", toResolve[i], { cur });
        if (r && r.pick) out[toResolve[i]] = { symbol: r.pick.symbol, name: r.name, type: r.type, mic: r.pick.mic, exchange: r.pick.exchange, wkn: r.wkn };
        if (dead) return;
        setProgress({ done: i + 1, total: toResolve.length });
        if (i + 1 < toResolve.length) await new Promise((res) => setTimeout(res, 350));
      }
      if (!dead) { setResolved(out); setProgress(null); }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur neu suchen, wenn sich die ISIN-Liste ändert
  }, [resolveKey, cur]);

  const busy = !!progress;
  const st = tx ? tx.stats : null;
  const range = tx && tx.txns.length ? [tx.txns[0].date, tx.txns[tx.txns.length - 1].date] : null;

  return (
    <div className="fc-form">
      {!file && (
        <>
          <div className="fc-detail-note" style={{ marginBottom: 14 }}>
            Exportiere deine Transaktionen als CSV – bei <b>Trade Republic</b> unter Profil → Transaktionsexport, bei <b>Scalable Capital</b> unter Transaktionen → Exportieren.
            Andere Broker gehen auch, wenn die Datei Spalten wie Datum, Typ, ISIN, Stück und Kurs hat.
            Die Datei wird nur auf diesem Gerät gelesen.
          </div>
          <Btn onClick={() => fileRef.current && fileRef.current.click()} style={{ gap: 8 }}><FileUp size={17} strokeWidth={1.9} /> CSV-Datei wählen</Btn>
          {err && <div className="fc-idhint err" style={{ marginTop: 12 }}>{err}</div>}
        </>
      )}
      <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain,*/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) pick(f); e.target.value = ""; }} />

      {file && tx && plan && (
        <>
          <div className="fc-idcard">
            <div className="t">{file.parsed.format === "CSV" ? "CSV-Datei" : file.parsed.format}<span className="fc-tag">{file.parsed.rows.length} Zeilen</span></div>
            <div className="s">{file.name}{range ? ` · ${fmtDay(range[0])} – ${fmtDay(range[1])}` : ""}</div>
            <div className="h">
              <Sub parts={[
                `${st.buy} ${st.buy === 1 ? "Kauf" : "Käufe"}`,
                `${st.sell} ${st.sell === 1 ? "Verkauf" : "Verkäufe"}`,
                `${st.div} ${st.div === 1 ? "Ausschüttung" : "Ausschüttungen"}`,
              ]} />
            </div>
            <div className="h" style={{ color: C.mutedSoft }}>
              {[
                st.skipped ? `${st.skipped} übersprungen (Ein-/Auszahlungen, Gebühren, Stornos)` : null,
                st.interest ? `${st.interest} Zinsbuchungen ohne Wertpapier` : null,
                st.invalid ? `${st.invalid} unvollständig` : null,
                plan.dup ? `${plan.dup} schon vorhanden` : null,
              ].filter(Boolean).join(" · ") || "Keine Zeilen übersprungen."}
            </div>
          </div>

          {plan.positions.length > 0 && (
            <>
              <div className="fc-detail-sec" style={{ marginTop: 4 }}>Positionen</div>
              {plan.positions.map((p) => (
                <div className="fc-detail-row" key={p.gkey}>
                  <div className="m static">
                    <div className="t">{p.name}{p.isNew ? <span className="fc-tag ok">neu</span> : null}</div>
                    <div className="s">
                      <Sub parts={[
                        p.symbol && p.symbol !== p.isin ? p.symbol : null,
                        p.isin || null,
                        p.isNew && !p.resolved && !busy && p.isin ? "Ticker nicht gefunden – Kurs von Hand" : null,
                      ]} />
                    </div>
                  </div>
                  <div className="r"><span className="a" style={{ fontWeight: 500 }}>{[p.buys ? `${p.buys}× Kauf` : "", p.sells ? `${p.sells}× Verk.` : "", p.divs ? `${p.divs}× Div.` : ""].filter(Boolean).join(" · ")}</span></div>
                </div>
              ))}
            </>
          )}

          {busy && <div className="fc-idhint" style={{ marginTop: 10 }}>Suche Ticker zu den ISINs … {progress.done}/{progress.total}</div>}
          {plan.replaceIds.length > 0 && <div className="fc-idhint" style={{ marginTop: 10 }}>{plan.replaceIds.length} geschätzte Sparplan-Käufe werden durch die echten Ausführungen ersetzt.</div>}
          {plan.converted > 0 && <div className="fc-idhint" style={{ marginTop: 10 }}>{plan.converted} Buchungen in Fremdwährung wurden zum heutigen Kurs in {cur} umgerechnet.</div>}
          {plan.missingFx.length > 0 && <div className="fc-idhint err" style={{ marginTop: 10 }}>Kein Wechselkurs für {plan.missingFx.join(", ")} – diese Beträge werden unverändert übernommen.</div>}
          {plan.oversold.length > 0 && <div className="fc-idhint err" style={{ marginTop: 10 }}>Mehr verkauft als gekauft bei {plan.oversold.join(", ")} – fehlen ältere Käufe im Export? Der Gewinn dieser Verkäufe wäre sonst zu hoch.</div>}

          <button type="button" className="fc-closedhead" style={{ margin: "14px 0 6px" }} onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
            <span className="m"><span className="t" style={{ fontSize: 14 }}>Spalten prüfen</span><span className="s">{Object.keys(map).length} von {FIELDS.length} Feldern erkannt</span></span>
            <ChevronDown size={17} strokeWidth={2} className={`chev ${showMap ? "open" : ""}`} />
          </button>
          {showMap && (
            <div className="fc-mapgrid">
              {FIELDS.map((fd) => (
                <label key={fd.id}>
                  <span>{fd.label}</span>
                  <select value={map[fd.id] ?? ""} onChange={(e) => {
                    const v = e.target.value;
                    setMap((m) => { const n = { ...m }; if (v === "") delete n[fd.id]; else n[fd.id] = Number(v); return n; });
                  }}>
                    <option value="">– keine –</option>
                    {file.parsed.header.map((h, i) => <option key={i} value={i}>{h || `Spalte ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}

          <CheckRow on={toCash} onToggle={() => setToCash((v) => !v)} style={{ marginTop: 8 }}>Erlöse und Ausschüttungen aufs Cash-Konto buchen</CheckRow>
          <div className="fc-detail-note" style={{ margin: "-6px 0 14px" }}>
            Nur einschalten, wenn du dein Verrechnungskonto in Vault als Cash-Konto führst – sonst zählt Geld doppelt, das längst wieder angelegt ist.
            Gebühren stecken im Kaufkurs, Steuern auf Ausschüttungen werden für den Pauschbetrag gemerkt.
          </div>
          <Btn disabled={!plan.count || busy} onClick={() => onImport(plan, { toCash })}>
            {busy ? "Ticker werden gesucht …" : plan.count ? `${plan.count} ${plan.count === 1 ? "Buchung" : "Buchungen"} importieren` : "Nichts Neues zu importieren"}
          </Btn>
          <button type="button" className="fc-mini" style={{ marginTop: 12 }} onClick={() => { setFile(null); setMap(null); }}>Andere Datei wählen</button>
        </>
      )}
    </div>
  );
}
