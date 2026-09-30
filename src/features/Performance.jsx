import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceArea, ReferenceDot, CartesianGrid } from "recharts";
import { C, MASK } from "../lib/constants.jsx";
import { eur, eurFull, fmtQty, fmtDay, getCur } from "../lib/currency.js";
import { tradeStats, perfSummary, holdLabel, sparerPauschbetrag } from "../lib/performance.js";
import { Btn, AssetLogo, Sub } from "../components/ui.jsx";

const sign = (v) => (v >= 0 ? "+" : "−");
const pctTxt = (v, d = 1) => `${sign(v)}${Math.abs(v).toFixed(d).replace(".", ",")} %`;
const tone = (v) => (v > 0 ? C.positive : v < 0 ? C.error : C.muted);
const signedEur = (v) => `${sign(v)}${eur(Math.abs(v))}`;

/* Marker für Käufe (▲) und Verkäufe (▼) im Kursverlauf */
const Tri = ({ cx, cy, up, color }) => (cx == null || cy == null ? null : (
  <path
    d={up ? `M${cx},${cy - 6} L${cx + 6},${cy + 5} L${cx - 6},${cy + 5} Z` : `M${cx},${cy + 6} L${cx + 6},${cy - 5} L${cx - 6},${cy - 5} Z`}
    fill={color}
    stroke="var(--c-canvas)"
    strokeWidth={1.5}
  />
));

/* ---------- Trade-Karte: eine verkaufte Position ---------- */
export function TradeCard({ group, divs = [], hist, fxRates = {}, archived, masked, onRebuy, onToggleArchive, onEdit, onDelete }) {
  const st = useMemo(() => tradeStats(group, divs), [group, divs]);
  const unit = group.type === "rohstoff" ? (group.ref.unit || "Einheiten") : "Stk";
  const M = (v) => (masked ? MASK : v);

  /* Kursverlauf: ab kurz vor dem ersten Kauf bis heute, Haltephase hinterlegt */
  const chart = useMemo(() => {
    const h = hist && hist.series ? hist : null;
    if (!h || !st.firstBuy) return null;
    const cur = getCur();
    const rate = h.ccy && h.ccy !== cur ? (Number(fxRates[h.ccy]) || 1) : 1;
    const start = new Date(st.firstBuy).getTime() - 21 * 86400000;
    let pts = Object.keys(h.series)
      .filter((d) => new Date(d).getTime() >= start)
      .sort()
      .map((d) => ({ t: new Date(d).getTime(), d, p: Number(h.series[d]) * rate }))
      .filter((x) => isFinite(x.p) && x.p > 0);
    if (pts.length < 2) return null;
    if (pts.length > 240) { const step = Math.ceil(pts.length / 240); pts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1); }
    const sellT = st.lastSell ? new Date(st.lastSell).getTime() : null;
    const rows = pts.map((x) => ({ ...x, a: sellT == null || x.t <= sellT ? x.p : null, b: sellT != null && x.t >= sellT ? x.p : null }));
    /* Übergang ohne Lücke: letzter Punkt vor dem Verkauf gehört zu beiden Linien */
    const iLast = rows.map((r) => r.a != null).lastIndexOf(true);
    if (iLast >= 0 && rows[iLast].b == null) rows[iLast].b = rows[iLast].a;
    const tMin = rows[0].t, tMax = rows[rows.length - 1].t;
    const inRange = (t) => t >= tMin && t <= tMax;
    const buys = (group.lots || []).filter((l) => l.buyDate && inRange(new Date(l.buyDate).getTime()))
      .map((l) => ({ t: new Date(l.buyDate).getTime(), p: Number(l.buyPrice) || 0 })).filter((x) => x.p > 0);
    const sells = st.sells.filter((s) => s.date && inRange(new Date(s.date).getTime()))
      .map((s) => ({ t: new Date(s.date).getTime(), p: Number(s.price) || 0 })).filter((x) => x.p > 0);
    return { rows, buys, sells, x1: new Date(st.firstBuy).getTime(), x2: sellT };
  }, [hist, st, group.lots, fxRates]);

  const fmtT = (t) => { const x = new Date(t); return `${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getFullYear()).slice(2)}`; };
  const lots = [...(group.lots || [])].sort((a, b) => (a.buyDate || "").localeCompare(b.buyDate || ""));
  const realizedById = {};
  for (const m of group.matches || []) realizedById[m.id] = m.realized;

  return (
    <div>
      {chart ? (
        <div style={{ width: "100%", height: 160, margin: "-4px 0 8px" }}>
          <ResponsiveContainer>
            <LineChart data={chart.rows} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fmtT} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} minTickGap={40} />
              <YAxis domain={["auto", "auto"]} width={masked ? 8 : 44} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} tickFormatter={(v) => (masked ? "" : Math.round(v).toLocaleString("de-DE"))} />
              {chart.x2 && <ReferenceArea x1={chart.x1} x2={chart.x2} fill={C.positive} fillOpacity={0.08} stroke="none" />}
              <Line type="monotone" dataKey="a" stroke={C.rausch} strokeWidth={2.2} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line type="monotone" dataKey="b" stroke={C.mutedSoft} strokeWidth={1.8} strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls={false} />
              {chart.buys.map((b, i) => <ReferenceDot key={`b${i}`} x={b.t} y={b.p} r={6} shape={(p) => <Tri {...p} up color={C.positive} />} ifOverflow="extendDomain" />)}
              {chart.sells.map((s, i) => <ReferenceDot key={`s${i}`} x={s.t} y={s.p} r={6} shape={(p) => <Tri {...p} color={C.error} />} ifOverflow="extendDomain" />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="fc-detail-note" style={{ marginBottom: 12 }}>
          Kein Kursverlauf verfügbar{group.type === "aktie" || group.type === "etf" ? " – für Aktien/ETFs braucht es den Twelve-Data-Key im Profil" : ""}.
        </div>
      )}

      <div className="fc-detail-kpis fc-kpis3">
        <div><span className="l">Einstand</span><span className="v">{M(eur(st.cost))}</span></div>
        <div><span className="l">Erlös</span><span className="v">{M(eur(st.proceeds))}</span></div>
        <div><span className="l">Gewinn</span><span className="v" style={{ color: tone(st.realized) }}>{M(signedEur(st.realized))}</span></div>
        <div><span className="l">Rendite</span><span className="v" style={{ color: tone(st.realized) }}>{st.pct == null ? "–" : pctTxt(st.pct)}</span></div>
        <div><span className="l">pro Jahr</span><span className="v" style={{ color: st.pa == null ? C.muted : tone(st.pa) }}>{st.pa == null ? "–" : pctTxt(st.pa)}</span></div>
        <div><span className="l">Haltedauer</span><span className="v">{holdLabel(st.holdDays)}</span></div>
        {st.divSum > 0 && <div><span className="l">Ausschüttungen</span><span className="v" style={{ color: C.positive }}>{M(`+${eur(st.divSum)}`)}</span></div>}
      </div>

      {st.since && (
        <div className="fc-since">
          <span className="big" style={{ color: st.since.pct == null ? C.ink : tone(st.since.pct) }}>
            {st.since.pct == null ? "–" : pctTxt(st.since.pct, 0)}
          </span>
          <span className="tx">
            <b>Seit Verkauf</b>
            {" – "}
            {Math.abs(st.since.ifHeld) < 1
              ? "Kurs praktisch unverändert."
              : st.since.ifHeld > 0
                ? <>gehalten wären es heute <b>{M(`+${eur(st.since.ifHeld)}`)}</b> mehr.</>
                : <>gut verkauft: <b>{M(eur(-st.since.ifHeld))}</b> Kursrückgang vermieden.</>}
            {" "}Verkauf {M(eurFull(st.since.lastPrice))}, Kurs {fmtDay(st.since.asOf)} {M(eurFull(st.since.price))}.
          </span>
        </div>
      )}

      <div className="fc-detail-sec">Käufe &amp; Verkäufe</div>
      {lots.map((l) => (
        <div className="fc-detail-row" key={l.id}>
          <button type="button" className="m" onClick={onEdit}>
            <span className="t"><span style={{ color: C.positive }}>▲</span> {fmtQty(l.qty)} {unit} × {M(eurFull(l.buyPrice || 0))}</span>
            <span className="s">{l.buyDate ? fmtDay(l.buyDate) : "ohne Kaufdatum"}</span>
          </button>
          <div className="r"><span className="a">{M(eur((Number(l.qty) || 0) * (Number(l.buyPrice) || 0)))}</span></div>
        </div>
      ))}
      {[...st.sells].reverse().map((s) => (
        <div className="fc-detail-row" key={s.id}>
          <button type="button" className="m" onClick={onEdit}>
            <span className="t"><span style={{ color: C.error }}>▼</span> {fmtQty(s.qty)} {unit} × {M(eurFull(s.price || 0))}</span>
            <span className="s"><Sub parts={[fmtDay(s.date), <span key="r" style={{ color: tone(realizedById[s.id] || 0) }}>{M(signedEur(realizedById[s.id] || 0))}</span>]} /></span>
          </button>
          <div className="r"><span className="a">{M(eur((Number(s.qty) || 0) * (Number(s.price) || 0)))}</span></div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Btn onClick={onRebuy}>Wieder kaufen</Btn>
        <Btn kind="ghost" onClick={onToggleArchive}>{archived ? "Einblenden" : "Ausblenden"}</Btn>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
        <button type="button" className="fc-mini" style={{ padding: 0 }} onClick={onEdit}>Käufe/Verkäufe bearbeiten</button>
        <button type="button" className="fc-mini danger" style={{ padding: 0 }} onClick={onDelete}>Endgültig löschen</button>
      </div>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        Die Position zählt weiter in Performance, Chart und Bilanz – auch ausgeblendet.
        Nur „Endgültig löschen“ entfernt Käufe und Verkäufe; die Performance wird dann ohne sie berechnet.
      </div>
    </div>
  );
}

/* ---------- Performance-Bilanz ---------- */
export function PerformanceSheet({ groups, divs = [], splitting, masked, logos = true, onOpen }) {
  const s = useMemo(() => perfSummary(groups, divs), [groups, divs]);
  const thisYear = String(new Date().getFullYear());
  const years = [...new Set([...s.years, thisYear])].sort();
  const [view, setView] = useState("all");
  const M = (v) => (masked ? MASK : v);
  const showTax = getCur() === "EUR";
  const pb = sparerPauschbetrag(splitting);

  const y = view === "all" ? null : (s.byYear[view] || { realized: 0, taxable: 0, divs: 0 });
  const parts = y
    ? [
        { label: "Realisiert (Verkäufe)", v: y.realized, color: "#b598ff" },
        { label: "Ausschüttungen & Zinsen", v: y.divs, color: "#f0a83a" },
      ]
    : [
        { label: "Offene Positionen", v: s.unreal, color: C.positive },
        { label: "Realisiert (Verkäufe)", v: s.realized, color: "#b598ff" },
        { label: "Ausschüttungen & Zinsen", v: s.divTotal, color: "#f0a83a" },
      ];
  const total = parts.reduce((a, p) => a + p.v, 0);
  const allPos = parts.every((p) => p.v >= 0) && total > 0;
  const onInvest = !y && s.invested > 0 ? (s.total / s.invested) * 100 : null;
  const taxYear = view === "all" ? thisYear : view;
  const tb = s.byYear[taxYear] || { taxable: 0, divs: 0, divsGross: 0 };
  /* Ausschüttungen brutto (Gutschrift + einbehaltene Steuer) – so zählt das Finanzamt */
  const taxUsed = Math.max(0, tb.taxable + (tb.divsGross != null ? tb.divsGross : tb.divs));

  return (
    <div>
      <div className="fc-seg" style={{ margin: "0 0 14px" }} role="group" aria-label="Zeitraum">
        {years.slice(-3).map((yy) => (
          <button key={yy} type="button" className={view === yy ? "active" : ""} aria-pressed={view === yy} onClick={() => setView(yy)}>{yy}</button>
        ))}
        <button type="button" className={view === "all" ? "active" : ""} aria-pressed={view === "all"} onClick={() => setView("all")}>Gesamt</button>
      </div>

      <div className="fc-perf-total">
        <div className="n" style={{ color: tone(total) }}>{M(signedEur(total))}</div>
        <div className="l">
          {y ? `realisiert + Ausschüttungen ${view}` : onInvest != null ? `${pctTxt(onInvest)} auf ${M(eur(s.invested))} Einsatz` : "Gesamtrendite"}
        </div>
      </div>

      {allPos && (
        <div className="fc-flowbar" style={{ height: 14 }}>
          {parts.filter((p) => p.v > 0).map((p) => <div key={p.label} style={{ width: `${(p.v / total) * 100}%`, background: p.color }} />)}
        </div>
      )}
      <div className="fc-perf-leg">
        {parts.map((p) => (
          <div key={p.label}>
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <b style={{ color: tone(p.v) }}>{M(signedEur(p.v))}</b>
          </div>
        ))}
      </div>

      {showTax && (
        <div className="fc-perf-tax">
          <div className="top">
            <span>Sparerpauschbetrag {taxYear}</span>
            <span>{M(`${eur(taxUsed)} / ${eur(pb)}`)}</span>
          </div>
          <div className="fc-goal"><div className="track"><span style={{ width: `${Math.min(100, (taxUsed / pb) * 100)}%`, background: taxUsed > pb ? C.error : C.positive }} /></div></div>
          <div className="fc-detail-note">
            {taxUsed > pb
              ? `${M(eur(taxUsed - pb))} über dem Freibetrag.`
              : `Noch ${M(eur(pb - taxUsed))} frei.`}
            {" "}Vereinfacht: realisierte Aktien/ETF-Gewinne und Ausschüttungen brutto (inkl. einbehaltener Steuer), ohne Teilfreistellung und Vorabpauschale.
            Krypto und Edelmetalle zählen nicht (§ 23 EStG).{splitting ? " Splitting laut Profil." : ""}
          </div>
        </div>
      )}

      {s.contributors.length > 0 && (
        <>
          <div className="fc-detail-sec">Top &amp; Flop</div>
          {s.contributors.slice(0, 8).map((c) => (
            <button type="button" className="fc-perf-row" key={c.gkey} onClick={() => onOpen && onOpen(c.gkey)}>
              <AssetLogo inv={c.ref} enabled={logos} />
              <span className="nm">{c.name}{c.closed && <span className="fc-tag">verkauft</span>}</span>
              <b style={{ color: tone(c.total) }}>{M(signedEur(c.total))}</b>
            </button>
          ))}
        </>
      )}
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        Verkaufte Positionen bleiben mit ihrem Ergebnis enthalten. Die %-Kurve im Chart ist zeitgewichtet –
        auch dort zählt die Entwicklung bis zum Verkauf weiter. Immobilien ohne Chart-Häkchen sind ausgeklammert.
      </div>
    </div>
  );
}


