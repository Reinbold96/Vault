import React, { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { RefreshCw } from "lucide-react";
import { C, SHADOW, MASK, BENCHMARKS, HIST_TYPES, CRYPTO_MAX_DAYS, CRYPTO_IDS, RANGES } from "../lib/constants.jsx";
import { locale, curSym, eur, eurFull } from "../lib/currency.js";
import { todayIso, addDays, daysBetween, yearStartIso } from "../lib/utils.js";
import { cashAmount, histKeyOf } from "../lib/finance.js";
import { fetchStockHistories, fetchCryptoHistory, fetchFxSeries } from "../lib/api.js";
import { computeSeries, mergeSeries, lastDateOf, firstDateOf } from "../lib/portfolioSeries.js";
import { Card, Fresh } from "../components/ui.jsx";

/* Letzte berechnete Kurve – überlebt Tab-Wechsel, damit der Chart nicht neu "lädt" */
const chartCache = { key: "", state: null };

/* Ab wann eine vorhandene Serie nur noch ergänzt wird: sie muss den nötigen Start
   abdecken. Dann reicht ein Abruf ab dem letzten Tag (minus Puffer für Korrekturen). */
const MINOR_CCY = ["GBp", "GBX", "ZAc", "ZAC", "ILA", "ILa"];
const covers = (h, startAll) => !!(h && h.series && lastDateOf(h.series)
  && !MINOR_CCY.includes(h.ccy) /* alte Pence-Serien einmal komplett neu laden */
  && (h.from ? h.from <= startAll : firstDateOf(h.series) <= addDays(startAll, 7)));
const incStart = (h) => addDays(lastDateOf(h.series), -5);

export default function PortfolioChart({ groups, cur, tdKey, fxRates, benchmarks, onToggleBenchmark, range: rangeProp, mode: modeProp, onRange, onMode, masked = false, hist: histProp, histReady = true, onHist }) {
  /* Zeitraum und Darstellung liegen in den Settings, damit die Wahl einen App-Neustart ueberlebt */
  const range = RANGES.some((r) => r.id === rangeProp) ? rangeProp : "6M";
  const mode = modeProp === "perf" ? "perf" : "value";
  const setRange = onRange;
  const setMode = onMode;
  const [hover, setHover] = useState(null);
  const chartBox = useRef(null);

  /* Gruppen mit Kurshistorie, Kaufdatum und Chart-Häkchen */
  const eligible = useMemo(() => groups.filter((g) =>
    HIST_TYPES.includes(g.type) && g.inChart && (g.ref.symbol || g.ref.coinId) && g.lots.some((l) => l.buyDate && l.inChart !== false)
  ), [groups]);
  const cashGroups = useMemo(() => groups.filter((g) => g.type === "cash" && g.inChart), [groups]);
  /* Immobilien laufen ohne Kursquelle - sie brauchen nur ein Kaufdatum */
  const propGroups = useMemo(() => groups.filter((g) => g.type === "immobilie" && g.inChart), [groups]);

  const bmKey = benchmarks.join(",");
  const activeBms = useMemo(() => BENCHMARKS.filter((b) => bmKey.split(",").includes(b.id)), [bmKey]);
  const eligKey = eligible.map((g) => `${g.gkey}|${g.lots.map((l) => `${l.qty}@${l.buyDate}`).join("+")}|${g.sells.map((s) => `${s.qty}@${s.date}`).join("+")}`).join(",");
  const cashKey = cashGroups.map((g) => `${g.gkey}|${cashAmount(g.ref)}|${g.ref.ccy || cur}|${(g.ref.flows || []).length}`).join(",");
  const propKey = propGroups.map((g) => `${g.gkey}|${g.ref.buyDate}|${g.ref.valMode || "value"}|${g.ref.growth || 0}|${g.ref.price}|${g.ref.buyPrice}`).join(",");

  /* Stale-while-revalidate: erst sofort aus dem Cache (auch von gestern) zeichnen,
     dann im Hintergrund fehlende Tage holen und die Kurve still austauschen. */
  const cacheKey = [eligKey, cashKey, propKey, bmKey, cur].join("§");
  const [state, setState] = useState(() => (chartCache.key === cacheKey && chartCache.state) || { loading: true, rows: [], notes: [], err: "" });
  const [refreshing, setRefreshing] = useState(false);

  /* Neueste Props für den Abruf – der Effekt selbst hängt nur an den Schlüsseln oben */
  const latest = useRef(null);
  useEffect(() => { latest.current = { eligible, cashGroups, propGroups, activeBms, histProp, fxRates, onHist }; });

  useEffect(() => {
    let cancelled = false;
    const publish = (next) => { chartCache.key = cacheKey; chartCache.state = next; setState(next); };
    async function build() {
      const { eligible, cashGroups, propGroups, activeBms, histProp, fxRates, onHist } = latest.current;
      if (!eligible.length && !cashGroups.length && !propGroups.length) { publish({ loading: false, rows: [], notes: [], err: "" }); return; }
      if (!histReady) return; /* IndexedDB noch nicht gelesen – Effekt läuft danach erneut */
      const hist = { ...(histProp || {}) };
      const changed = new Set();
      const today = todayIso();
      const buyDates = [
        ...eligible.flatMap((g) => g.lots.map((l) => l.buyDate).filter(Boolean)),
        ...propGroups.map((g) => g.ref.buyDate).filter(Boolean),
      ];
      const earliest = buyDates.length ? buyDates.sort()[0] : addDays(today, -180);
      const startAll = earliest < addDays(today, -3650) ? addDays(today, -3650) : earliest;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      /* --- benötigte Serien --- */
      const need = [];
      for (const g of eligible) {
        if (g.type === "krypto") need.push({ key: histKeyOf(g, cur), kind: "crypto", g });
        else need.push({ key: histKeyOf(g, cur), kind: "stock", sym: (g.ref.symbol || "").toUpperCase() });
      }
      for (const b of activeBms) need.push({ key: `td:${b.sym}`, kind: "stock", sym: b.sym, bm: b });
      const uniq = [];
      const seen = new Set();
      for (const n of need) { if (!seen.has(n.key)) { seen.add(n.key); uniq.push(n); } }
      const hasSeries = (key) => !!(hist[key] && hist[key].series);

      /* Wechselkurse: Kurse, Benchmarks und Cash-Konten in Fremdwährung */
      const fxNeed = () => {
        const set = new Set();
        for (const n of uniq) { const h = hist[n.key]; if (h && h.ccy && h.ccy !== cur) set.add(h.ccy); }
        for (const g of cashGroups) { const c = g.ref.ccy || cur; if (c !== cur) set.add(c); }
        return [...set];
      };
      const cachedFx = () => {
        const out = {};
        for (const ccy of fxNeed()) { const h = hist[`fx:${ccy}:${cur}`]; if (h && h.series) out[ccy] = h.series; }
        return out;
      };
      const compute = (fx) => computeSeries({ eligible, cashGroups, propGroups, hist, fx, fxRates, cur, start: startAll, end: today, bms: activeBms });
      const finish = (res, notes, stillLoading) => {
        const all = [...notes];
        if (res.flatNames.size) all.push(`Ohne Kurshistorie, mit heutigem Kurs gezählt: ${[...res.flatNames].join(", ")}`);
        publish({ loading: false, rows: res.rows, notes: [...new Set(all)], err: res.rows.length || stillLoading ? "" : "Keine Kursdaten für den Zeitraum gefunden" });
      };

      /* Dauerhafte Hinweise (Konfiguration) – unabhängig vom Netz */
      const staticNotes = [];
      for (const n of uniq) {
        if (n.kind === "crypto" && !(n.g.ref.coinId || CRYPTO_IDS[(n.g.ref.symbol || "").toUpperCase()]) && !hasSeries(n.key)) staticNotes.push(`${n.g.name}: keine Krypto-ID`);
      }
      const stale = uniq.filter((n) => { const c = hist[n.key]; return !(c && c.fetched === today && c.series && covers(c, startAll)); });
      const staleStocks = stale.filter((x) => x.kind === "stock");
      if (staleStocks.length && !tdKey && staleStocks.some((x) => !hasSeries(x.key))) staticNotes.push("Für Kurshistorie von Aktien/ETFs den Twelve-Data-Key in den Einstellungen eintragen");
      const fxStale = fxNeed().filter((ccy) => { const h = hist[`fx:${ccy}:${cur}`]; return !(h && h.fetched === today && covers(h, startAll)); });
      const willFetch = stale.some((x) => x.kind === "crypto") || (staleStocks.length > 0 && !!tdKey) || fxStale.length > 0;

      /* Phase 1: sofort mit dem, was da ist */
      finish(compute(cachedFx()), staticNotes, willFetch);
      if (!willFetch) { setRefreshing(false); return; }
      setRefreshing(true);

      /* Phase 2: im Hintergrund nachladen – nur die fehlenden Tage, wo möglich.
         Netzfehler nur melden, wenn es gar keine (auch keine ältere) Serie gibt. */
      const notes = [...staticNotes];
      /* reqStart: ab wann dieser Abruf lief. Passt eine ergänzende Antwort nicht zur alten
         Serie (andere Währung), gilt nur ihr eigener Zeitraum – beim nächsten Mal wird dann
         komplett neu geladen, statt die Historie abgeschnitten stehen zu lassen. */
      const store = (key, ccy, series, reqStart) => {
        const old = hist[key];
        const inc = old && covers(old, startAll) && ccy === (old.ccy || ccy);
        hist[key] = { fetched: today, ...(ccy ? { ccy } : {}), from: inc ? (old.from || startAll) : reqStart, series: inc ? mergeSeries(old.series, series) : series };
        changed.add(key);
      };
      let planBlocked = [], limitHit = false;
      for (const n of stale.filter((x) => x.kind === "crypto")) {
        const coinId = n.g.ref.coinId || CRYPTO_IDS[(n.g.ref.symbol || "").toUpperCase()];
        if (!coinId) continue;
        try {
          const old = hist[n.key];
          const from = old && covers(old, startAll) ? incStart(old) : startAll;
          const days = Math.min(CRYPTO_MAX_DAYS, Math.max(2, daysBetween(from, today) + 1));
          const r = await fetchCryptoHistory(coinId, cur, days);
          store(n.key, r.ccy, r.series, from);
          await sleep(400);
        } catch {
          if (!hasSeries(n.key)) notes.push(`${n.g.name}: keine Historie`);
        }
        if (cancelled) return;
      }
      /* Aktien/ETFs/Benchmarks: Twelve Data – mehrere Symbole je Request (Gratis-Tarif:
         8 Requests/Min). Getrennt nach "nur ergänzen" und "komplett". */
      if (staleStocks.length && tdKey) {
        const incr = staleStocks.filter((x) => covers(hist[x.key], startAll));
        const full = staleStocks.filter((x) => !covers(hist[x.key], startAll));
        const batches = [];
        if (incr.length) batches.push({ syms: [...new Set(incr.map((x) => x.sym))], start: incr.map((x) => incStart(hist[x.key])).sort()[0] });
        if (full.length) batches.push({ syms: [...new Set(full.map((x) => x.sym))], start: startAll });
        outer: for (const b of batches) {
          for (let i = 0; i < b.syms.length; i += 8) {
            const chunk = b.syms.slice(i, i + 8);
            try {
              const res = await fetchStockHistories(chunk, tdKey, b.start);
              for (const sym of chunk) {
                const r = res[sym];
                if (r && r.error === "PLAN") { planBlocked.push(sym); continue; }
                if (!r || r.error) { if (!hasSeries(`td:${sym}`)) notes.push(`${sym}: keine Historie`); continue; }
                store(`td:${sym}`, r.ccy, r.series, b.start);
              }
            } catch (e) {
              if (String(e.message) === "LIMIT") { limitHit = true; break outer; }
              if (String(e.message) === "PLAN") planBlocked.push(...chunk);
              else for (const sym of chunk) if (!hasSeries(`td:${sym}`)) notes.push(`${sym}: keine Historie`);
            }
            if (cancelled) return;
            await sleep(900);
          }
        }
      }
      if (planBlocked.length) notes.push(`Nicht im Gratis-Tarif: ${[...new Set(planBlocked)].join(", ")}`);
      if (limitHit && staleStocks.some((x) => !hasSeries(x.key))) notes.push("Datenlimit erreicht – später erneut öffnen");
      if (cancelled) return;

      /* --- Wechselkurse (nach den Kursen: erst dann ist jede Serien-Währung bekannt) --- */
      const fx = cachedFx();
      for (const ccy of fxNeed()) {
        const fxKey = `fx:${ccy}:${cur}`;
        const old = hist[fxKey];
        if (old && old.fetched === today && covers(old, startAll)) continue;
        try {
          const from = old && covers(old, startAll) ? incStart(old) : startAll;
          const s2 = await fetchFxSeries(ccy, cur, from);
          if (s2) { store(fxKey, "", s2, from); fx[ccy] = hist[fxKey].series; }
        } catch { if (!fx[ccy]) notes.push(`Wechselkurs ${ccy}→${cur} nicht verfügbar`); }
      }
      if (cancelled) return;
      if (changed.size && onHist) onHist(hist, [...changed]);
      finish(compute(fx), notes, false);
      setRefreshing(false);
    }
    build();
    return () => { cancelled = true; };
  }, [cacheKey, eligKey, cashKey, propKey, bmKey, cur, tdKey, histReady]);

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
  }, [state.rows, range, activeBms]);

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
          <span className={`val ${masked ? "mask" : ""}`}>{masked ? MASK : hoverRow ? eur(hoverRow.value) : <Fresh v={view.last ? Math.round(view.last.value) : 0}>{view.last ? eur(view.last.value) : "–"}</Fresh>}</span>
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
          {refreshing && <span className="fc-chart-sync" title="Kursverlauf wird im Hintergrund aktualisiert" aria-label="Kursverlauf wird aktualisiert"><RefreshCw size={11} strokeWidth={2.2} /></span>}
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
        {state.loading && view.rows.length < 2 ? (
          <div className="fc-chart-skel" aria-label="Kursverlauf wird vorbereitet" />
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
      {showBms && cur !== "USD" && (
        <div className="fc-chart-note">Indizes in {cur} umgerechnet – wie dein Depot, inklusive Währungseffekt.</div>
      )}

      {state.notes.length > 0 && (
        <div className="fc-chart-note">
          {state.notes.slice(0, 3).map((n, i) => <div key={i}>{n}</div>)}
        </div>
      )}
    </Card>
  );
}
