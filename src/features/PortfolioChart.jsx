import React, { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { C, SHADOW, MASK, BENCHMARKS, HIST_TYPES, CRYPTO_MAX_DAYS, CRYPTO_IDS, RANGES } from "../lib/constants.jsx";
import { locale, curSym, eur, eurFull } from "../lib/currency.js";
import { todayIso, addDays, daysBetween, eachDay, yearStartIso } from "../lib/utils.js";
import { fifoAt, cashAmount, cashAtDate, propValueAt, histKeyOf } from "../lib/finance.js";
import { fetchStockHistories, fetchCryptoHistory, fetchFxSeries, fillForward } from "../lib/api.js";
import { Card } from "../components/ui.jsx";

export default function PortfolioChart({ groups, cur, tdKey, fxRates, benchmarks, onToggleBenchmark, range: rangeProp, mode: modeProp, onRange, onMode, masked = false, hist: histProp, histReady = true, onHist }) {
  /* Zeitraum und Darstellung liegen in den Settings, damit die Wahl einen App-Neustart ueberlebt */
  const range = RANGES.some((r) => r.id === rangeProp) ? rangeProp : "6M";
  const mode = modeProp === "perf" ? "perf" : "value";
  const setRange = onRange;
  const setMode = onMode;
  const [hover, setHover] = useState(null);
  const chartBox = useRef(null);
  const [state, setState] = useState({ loading: false, rows: [], notes: [], err: "" });

  /* Gruppen mit Kurshistorie, Kaufdatum und Chart-Häkchen */
  const eligible = useMemo(() => groups.filter((g) =>
    HIST_TYPES.includes(g.type) && g.inChart && (g.ref.symbol || g.ref.coinId) && g.lots.some((l) => l.buyDate && l.inChart !== false)
  ), [groups]);
  const cashGroups = useMemo(() => groups.filter((g) => g.type === "cash" && g.inChart), [groups]);
  /* Immobilien laufen ohne Kursquelle - sie brauchen nur ein Kaufdatum */
  const propGroups = useMemo(() => groups.filter((g) => g.type === "immobilie" && g.inChart), [groups]);

  const activeBms = BENCHMARKS.filter((b) => benchmarks.includes(b.id));
  const eligKey = eligible.map((g) => `${g.gkey}|${g.lots.map((l) => `${l.qty}@${l.buyDate}`).join("+")}|${g.sells.map((s) => `${s.qty}@${s.date}`).join("+")}`).join(",");
  const cashKey = cashGroups.map((g) => `${g.gkey}|${cashAmount(g.ref)}|${g.ref.ccy || cur}|${(g.ref.flows || []).length}`).join(",");
  const propKey = propGroups.map((g) => `${g.gkey}|${g.ref.buyDate}|${g.ref.valMode || "value"}|${g.ref.growth || 0}|${g.ref.price}|${g.ref.buyPrice}`).join(",");
  const bmKey = benchmarks.join(",");

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!eligible.length && !cashGroups.length && !propGroups.length) { setState({ loading: false, rows: [], notes: [], err: "" }); return; }
      if (!histReady) return; /* IndexedDB noch nicht gelesen – Effekt läuft danach erneut */
      setState((s) => ({ ...s, loading: true, err: "" }));
      const notes = [];
      const hist = { ...(histProp || {}) };
      let histChanged = false;
      const today = todayIso();
      const buyDates = [
        ...eligible.flatMap((g) => g.lots.map((l) => l.buyDate).filter(Boolean)),
        ...propGroups.map((g) => g.ref.buyDate).filter(Boolean),
      ];
      const earliest = buyDates.length ? buyDates.sort()[0] : addDays(today, -180);
      const startAll = earliest < addDays(today, -3650) ? addDays(today, -3650) : earliest;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      /* --- benötigte Serien laden (Tages-Cache) --- */
      const need = [];
      for (const g of eligible) {
        if (g.type === "krypto") need.push({ key: histKeyOf(g, cur), kind: "crypto", g });
        else need.push({ key: histKeyOf(g, cur), kind: "stock", sym: (g.ref.symbol || "").toUpperCase() });
      }
      for (const b of activeBms) need.push({ key: `td:${b.sym}`, kind: "stock", sym: b.sym, bm: b });

      const uniq = [];
      const seen = new Set();
      for (const n of need) { if (!seen.has(n.key)) { seen.add(n.key); uniq.push(n); } }

      let planBlocked = [], limitHit = false;
      const stale = uniq.filter((n) => { const c = hist[n.key]; return !(c && c.fetched === today && c.series); });
      /* Krypto: CoinGecko, ein Request je Coin */
      for (const n of stale.filter((x) => x.kind === "crypto")) {
        try {
          const coinId = n.g.ref.coinId || CRYPTO_IDS[(n.g.ref.symbol || "").toUpperCase()];
          if (!coinId) { notes.push(`${n.g.name}: keine Krypto-ID`); continue; }
          const days = Math.min(CRYPTO_MAX_DAYS, Math.max(2, daysBetween(startAll, today) + 1));
          const r = await fetchCryptoHistory(coinId, cur, days);
          hist[n.key] = { fetched: today, ccy: r.ccy, series: r.series };
          histChanged = true;
          await sleep(400);
        } catch {
          notes.push(`${n.g.name}: keine Historie`);
        }
      }
      /* Aktien/ETFs/Benchmarks: Twelve Data – ALLE Symbole in einem Request
         (Gratis-Tarif: 8 Requests/Min – so reicht einer statt zwölf) */
      const stocks = stale.filter((x) => x.kind === "stock");
      if (stocks.length && !tdKey) notes.push("Für Kurshistorie von Aktien/ETFs den Twelve-Data-Key in den Einstellungen eintragen");
      if (stocks.length && tdKey) {
        const syms = [...new Set(stocks.map((x) => x.sym))];
        for (let i = 0; i < syms.length; i += 8) {
          const chunk = syms.slice(i, i + 8);
          try {
            const res = await fetchStockHistories(chunk, tdKey, startAll);
            for (const sym of chunk) {
              const r = res[sym];
              if (!r) { notes.push(`${sym}: keine Historie`); continue; }
              if (r.error === "PLAN") { planBlocked.push(sym); continue; }
              if (r.error) { notes.push(`${sym}: keine Historie`); continue; }
              hist[`td:${sym}`] = { fetched: today, ccy: r.ccy, series: r.series };
              histChanged = true;
            }
          } catch (e) {
            if (String(e.message) === "LIMIT") { limitHit = true; break; }
            if (String(e.message) === "PLAN") planBlocked.push(...chunk);
            else notes.push(`${chunk.join(", ")}: keine Historie`);
          }
          if (i + 8 < syms.length) await sleep(900);
        }
      }
      if (planBlocked.length) notes.push(`Nicht im Gratis-Tarif: ${[...new Set(planBlocked)].join(", ")}`);
      if (limitHit) notes.push("Datenlimit erreicht – in 1 Minute erneut öffnen");
      if (cancelled) return;

      /* --- Wechselkurse für Fremdwährungen (Kurse und Cash-Konten) --- */
      const needFx = new Set();
      for (const n of uniq) { const h = hist[n.key]; if (h && h.ccy && h.ccy !== cur) needFx.add(h.ccy); }
      for (const g of cashGroups) { const c = g.ref.ccy || cur; if (c !== cur) needFx.add(c); }
      const fx = {};
      for (const ccy of needFx) {
        const fxKey = `fx:${ccy}:${cur}`;
        if (hist[fxKey] && hist[fxKey].fetched === today) { fx[ccy] = hist[fxKey].series; continue; }
        try {
          const s = await fetchFxSeries(ccy, cur, startAll);
          if (s) { fx[ccy] = s; hist[fxKey] = { fetched: today, series: s }; histChanged = true; }
        } catch { notes.push(`Wechselkurs ${ccy}→${cur} nicht verfügbar`); }
      }
      if (histChanged && onHist) onHist(hist);
      if (cancelled) return;

      /* --- Zeitachse & Serien zusammensetzen --- */
      const dates = eachDay(startAll, today);
      const filled = {};
      for (const n of uniq) {
        const h = hist[n.key];
        if (h && h.series) filled[n.key] = fillForward(h.series, dates);
      }
      const fxFilled = {};
      for (const [ccy, s] of Object.entries(fx)) fxFilled[ccy] = fillForward(s, dates);

      /* Zeitgewichtete Rendite über die Wertpapiere: Zu- und Verkäufe verzerren die
         Kurve nicht, dadurch ist der Vergleich mit den Indizes fair. Cash zählt nur im Wert. */
      const chartLots = new Map();
      for (const g of eligible) chartLots.set(g.gkey, g.lots.filter((l) => l.inChart !== false && l.buyDate));
      const rows = [];
      let twr = 100, prev = null;
      for (const d of dates) {
        let assets = 0, invested = 0, any = false;
        const px = {};
        for (const g of eligible) {
          const pos = fifoAt(chartLots.get(g.gkey) || [], g.sells, d);
          if (pos.openQty <= 1e-10) continue;
          const key = histKeyOf(g, cur);
          const ser = filled[key];
          const raw = ser && ser[d];
          if (raw == null) continue;
          const h = hist[key];
          const rate = h && h.ccy && h.ccy !== cur ? (fxFilled[h.ccy] && fxFilled[h.ccy][d]) : 1;
          if (rate == null) continue;
          const p = raw * rate;
          px[g.gkey] = { p, qty: pos.openQty };
          assets += pos.openQty * p;
          invested += pos.openCost;
          any = true;
        }
        /* Cash: heutiger Stand minus alle späteren Zuflüsse, in Anzeigewährung */
        let cash = 0;
        for (const g of cashGroups) {
          const ccy = g.ref.ccy || cur;
          const r = ccy === cur ? 1 : ((fxFilled[ccy] && fxFilled[ccy][d]) ?? (fxRates && fxRates[ccy]) ?? 1);
          cash += cashAtDate(g.ref, d) * r;
        }
        /* Immobilien: eigener Wertverlauf, ohne Kursquelle. Sie gehen als Pseudo-Position
           in die Renditekette ein, damit die %-Kurve ihr Wachstum ebenfalls zeigt. */
        let props = 0;
        for (const g of propGroups) {
          if (g.ref.buyDate && g.ref.buyDate > d) continue;
          const pv = propValueAt(g.ref, d);
          if (!(pv > 0)) continue;
          props += pv;
          px["prop:" + g.gkey] = { p: pv, qty: 1 };
        }
        if (!any && cash === 0 && props === 0) continue;
        if (prev) {
          let num = 0, den = 0;
          for (const k of Object.keys(prev.px)) {
            const a = prev.px[k], b = px[k];
            if (!a || !b) continue;
            num += a.qty * b.p;
            den += a.qty * a.p;
          }
          if (den > 0) twr *= num / den;
        }
        const row = { d, value: assets + cash + props, assets, cash, props, invested, gain: assets - invested, twr };
        for (const b of activeBms) {
          const ser = filled[`td:${b.sym}`];
          row["bm_" + b.id] = ser && ser[d] != null ? ser[d] : null;
        }
        rows.push(row);
        prev = { d, px };
      }

      setState({ loading: false, rows, notes: [...new Set(notes)], err: rows.length ? "" : "Keine Kursdaten für den Zeitraum gefunden" });
    }
    build();
    return () => { cancelled = true; };
  }, [eligKey, cashKey, propKey, bmKey, cur, tdKey, histReady]);

  /* --- Zeitraum zuschneiden, Benchmarks auf Startpunkt normalisieren --- */
  const view = useMemo(() => {
    const r = RANGES.find((x) => x.id === range) || RANGES.find((x) => x.id === "6M");
    let rows = state.rows;
    if (r.ytd) { const from = yearStartIso(); rows = rows.filter((x) => x.d >= from); }
    else if (r.days) { const from = addDays(todayIso(), -r.days); rows = rows.filter((x) => x.d >= from); }
    if (!rows.length) return { rows: [], first: null, last: null };
    const first = rows[0], last = rows[rows.length - 1];
    const bmBase = {};
    for (const b of activeBms) {
      const f = rows.find((x) => x["bm_" + b.id] != null);
      bmBase[b.id] = f ? f["bm_" + b.id] : null;
    }
    const twrBase = first.twr;
    let out = rows.map((x) => {
      const o = { d: x.d, value: x.value, perf: twrBase ? (x.twr / twrBase - 1) * 100 : null };
      for (const b of activeBms) {
        const base = bmBase[b.id];
        o["bm_" + b.id] = base && x["bm_" + b.id] != null ? (x["bm_" + b.id] / base - 1) * 100 : null;
      }
      return o;
    });
    /* für flüssiges Rendern ausdünnen */
    if (out.length > 400) { const step = Math.ceil(out.length / 400); out = out.filter((_, idx) => idx % step === 0 || idx === out.length - 1); }
    return { rows: out, first, last };
  }, [state.rows, range, bmKey]);

  /* Die Darstellung haengt nur noch am Umschalter. Vergleichsindizes werden
     ausschliesslich in der %-Ansicht gezeichnet, blockieren den Wechsel aber nicht. */
  const showPerf = mode === "perf";
  const showBms = showPerf && activeBms.length > 0;
  /* Index einschalten heisst: vergleichen wollen -> aus der Wert-Ansicht automatisch auf % */
  const toggleBm = (id) => {
    const wasOn = benchmarks.includes(id);
    onToggleBenchmark(id);
    if (!wasOn && !showPerf) setMode("perf");
  };
  /* Gewinnänderung im Zeitraum: Buchgewinn-Differenz plus die in dieser Zeit realisierten Gewinne */
  const realizedWin = useMemo(() => {
    if (!view.first || !view.last) return 0;
    let sum = 0;
    for (const g of eligible) for (const m of g.matches || []) {
      if (m.date && m.date > view.first.d && m.date <= view.last.d) sum += m.realized;
    }
    return sum;
  }, [view.first, view.last, eligible]);
  /* Wertänderung im Zeitraum: Buchgewinn der Wertpapiere + realisierte Gewinne
     + Wertsteigerung der Immobilien. Cash-Zuflüsse zählen nicht als Gewinn. */
  const propChg = view.first && view.last ? (view.last.props || 0) - (view.first.props || 0) : 0;
  const chg = view.first && view.last ? (view.last.gain - view.first.gain) + realizedWin + propChg : 0;
  const chgPct = view.first && view.last && view.first.twr ? (view.last.twr / view.first.twr - 1) * 100 : 0;
  const hoverRow = hover != null && view.rows[hover] ? view.rows[hover] : null;
  const fmtDate = (d) => { const x = new Date(d); return `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getFullYear()).slice(2)}`; };
  /* Achsenbeschriftung so genau, dass keine zwei Ticks gleich aussehen:
     die Genauigkeit richtet sich nach der Spannweite der Werte im Zeitraum. */
  const span = useMemo(() => {
    if (!view.rows.length) return 0;
    const vals = view.rows.map((x) => x.value).filter((v) => v != null);
    return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  }, [view.rows]);
  /* Tippen ausserhalb des Charts schliesst die Werte-Box wieder */
  useEffect(() => {
    if (hover == null) return;
    const onDown = (e) => { if (!chartBox.current || !chartBox.current.contains(e.target)) setHover(null); };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [hover]);

  const nf = (v, dec) => v.toLocaleString(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const axisVal = (v) => {
    const a = Math.abs(v);
    if (span >= 2e6) return nf(v / 1e6, 1) + " Mio";
    if (span >= 2e5) return nf(v / 1e3, 0) + "k";
    if (span >= 2e4) return nf(v / 1e3, 1) + "k";
    if (a >= 1e6) return nf(v / 1e6, 2) + " Mio";
    return nf(Math.round(v), 0);
  };

  return (
    <Card style={{ paddingBottom: 12 }}>
      <div className="fc-chart-head">
        {/* Wert und Veränderung teilen eine Zeile - spart eine Zeile Höhe */}
        <div className="fc-chart-val">
          <span className={`val ${masked ? "mask" : ""}`}>{masked ? MASK : hoverRow ? eur(hoverRow.value) : view.last ? eur(view.last.value) : "–"}</span>
          {hoverRow ? (
            <span className="chg" style={{ color: C.muted }}>
              {fmtDate(hoverRow.d)}
              {showPerf && hoverRow.perf != null && <> · {hoverRow.perf >= 0 ? "+" : ""}{hoverRow.perf.toFixed(1).replace(".", ",")} %</>}
            </span>
          ) : view.first && view.last ? (
            <span className="chg" style={{ color: chg >= 0 ? C.positive : C.error }}>
              {!masked && <>{chg >= 0 ? "+" : ""}{eur(chg)} · </>}{chgPct >= 0 ? "+" : ""}{chgPct.toFixed(1).replace(".", ",")} %
            </span>
          ) : null}
        </div>
        <div className="fc-chart-modes">
          <button className={!showPerf ? "active" : ""} onClick={() => setMode("value")} title={`Wert in ${cur}`} aria-label={`Wert in ${cur}`}>{curSym()}</button>
          <button className={showPerf ? "active" : ""} onClick={() => setMode("perf")} title="Entwicklung in Prozent" aria-label="Entwicklung in Prozent">%</button>
        </div>
      </div>

      <div className="fc-ranges">
        {RANGES.map((r) => (
          <button key={r.id} className={range === r.id ? "active" : ""} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
      </div>

      <div ref={chartBox} style={{ width: "100%", height: 236, marginTop: 8 }}>
        {state.loading ? (
          <div className="fc-chart-empty">Kursverlauf wird geladen …</div>
        ) : view.rows.length < 2 ? (
          <div className="fc-chart-empty">{state.err || "Noch keine Daten – Kaufdatum bei den Positionen eintragen."}</div>
        ) : (
          <ResponsiveContainer>
            <LineChart
              data={view.rows}
              margin={{ top: 12, right: 10, bottom: 0, left: 0 }}
              onMouseMove={(s) => setHover(s && s.activeTooltipIndex != null ? s.activeTooltipIndex : null)}
              onTouchMove={(s) => setHover(s && s.activeTooltipIndex != null ? s.activeTooltipIndex : null)}
              onClick={(s) => setHover(s && s.activeTooltipIndex != null ? s.activeTooltipIndex : null)}
              onMouseLeave={() => setHover(null)}
            >
              <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
              <XAxis dataKey="d" tickFormatter={fmtDate} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} minTickGap={38} />
              <YAxis domain={["auto", "auto"]} allowDecimals={false} tickFormatter={(v) => (showPerf ? `${Math.round(v)} %` : masked ? "" : axisVal(v))} width={showPerf ? 46 : masked ? 10 : 58} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} />
              <Tooltip
                active={hover != null}
                labelFormatter={fmtDate}
                formatter={(v, n) => [showPerf ? `${Number(v).toFixed(1).replace(".", ",")} %` : masked ? MASK : eurFull(v), n]}
                contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 12.5, boxShadow: SHADOW }}
                labelStyle={{ color: C.muted }}
                itemStyle={{ color: C.ink }}
                cursor={{ stroke: C.borderStrong, strokeWidth: 1, strokeDasharray: "3 3" }}
                /* Bei nur einer Linie steht der Wert schon im Kopf */
                content={showBms ? undefined : () => null}
              />
              <Line type="monotone" dataKey={showPerf ? "perf" : "value"} name="Portfolio" stroke={C.rausch} strokeWidth={2.4} dot={false} connectNulls />
              {showPerf && activeBms.map((b) => (
                <Line key={b.id} type="monotone" dataKey={"bm_" + b.id} name={b.label} stroke={b.color} strokeWidth={1.7} dot={false} connectNulls strokeDasharray="4 3" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className={`fc-bmrow ${!showPerf ? "dim" : ""}`}>
        {BENCHMARKS.map((b) => {
          const on = benchmarks.includes(b.id);
          return (
            <button key={b.id} className={`fc-bm ${on ? "on" : ""}`} onClick={() => toggleBm(b.id)} style={on ? { borderColor: b.color, color: b.color } : undefined}>
              <span className="dot" style={{ background: on ? b.color : C.borderStrong }} /><span className="lbl">{b.label}</span>
            </button>
          );
        })}
      </div>

      {!showPerf && activeBms.length > 0 && (
        <div className="fc-chart-note">Vergleichsindizes werden in der %-Ansicht angezeigt.</div>
      )}

      {state.notes.length > 0 && (
        <div className="fc-chart-note">
          {state.notes.slice(0, 2).map((n, i) => <div key={i}>{n}</div>)}
        </div>
      )}
    </Card>
  );
}
