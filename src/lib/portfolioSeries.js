/* ---------- Portfolio-Verlauf ----------
   Tageswerte für den Invest-Chart, aus Kurshistorie, Wechselkursen, Cash-Flüssen und
   Immobilienwerten. Die %-Kurve ist zeitgewichtet (TWR): Zu- und Verkäufe verzerren
   sie nicht, dadurch ist der Vergleich mit den Indizes fair.
   Performance: Der Bestand einer Position ändert sich nur an Kauf-/Verkaufstagen – er
   wird deshalb einmal je Ereignis nach FIFO berechnet und für die Tage dazwischen per
   Binärsuche nachgeschlagen (statt FIFO für jeden Tag × jede Position). */
import { fifo, cashAtDate, propValueAt, histKeyOf } from "./finance.js";
import { fillForward } from "./api.js";
import { eachDay } from "./utils.js";

/* Bestand/Einstand je Ereignistag */
export function fifoTimeline(lots, sells) {
  const dated = lots.filter((l) => l.buyDate);
  const days = [...new Set([...dated.map((l) => l.buyDate), ...sells.map((s) => s.date).filter(Boolean)])].sort();
  return days.map((d) => {
    const f = fifo(dated.filter((l) => l.buyDate <= d), sells.filter((s) => (s.date || "") <= d));
    return { d, openQty: f.openQty, openCost: f.openCost };
  });
}

/* Letzter Eintrag ≤ d (sortierte Liste) */
export function lastAtOrBefore(sorted, d, key = (x) => x.d) {
  let lo = 0, hi = sorted.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (key(sorted[mid]) <= d) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best < 0 ? null : sorted[best];
}
const ZERO = { openQty: 0, openCost: 0 };
export const posAt = (timeline, d) => lastAtOrBefore(timeline, d) || ZERO;

/* eligible: Wertpapier-Gruppen mit Historie · cashGroups · propGroups
   hist: Serien-Cache · fx: { CCY: { tag: kurs } } · fxRates: heutige Kurse (Fallback)
   bms: Vergleichsindizes [{ id, sym }] – werden in die Anzeigewährung umgerechnet */
export function computeSeries({ eligible = [], cashGroups = [], propGroups = [], hist = {}, fx = {}, fxRates = {}, cur = "EUR", start, end, bms = [] }) {
  const dates = eachDay(start, end);
  const filled = {};
  const keyOf = (g) => histKeyOf(g, cur);
  for (const g of eligible) {
    const k = keyOf(g);
    if (!filled[k] && hist[k] && hist[k].series) filled[k] = fillForward(hist[k].series, dates);
  }
  for (const b of bms) {
    const k = `td:${b.sym}`;
    if (!filled[k] && hist[k] && hist[k].series) filled[k] = fillForward(hist[k].series, dates);
  }
  const fxFilled = {};
  for (const [ccy, s] of Object.entries(fx)) if (s) fxFilled[ccy] = fillForward(s, dates);
  /* 1 Einheit ccy in Anzeigewährung am Tag d – ohne Historie der heutige Kurs */
  const rateAt = (ccy, d) => {
    if (!ccy || ccy === cur) return 1;
    const v = fxFilled[ccy] && fxFilled[ccy][d];
    return v != null ? v : (fxRates && fxRates[ccy]) || null;
  };

  const timelines = new Map();
  for (const g of eligible) timelines.set(g.gkey, fifoTimeline(g.lots.filter((l) => l.inChart !== false && l.buyDate), g.sells || []));

  const rows = [];
  const flatNames = new Set();
  let twr = 100, prev = null;
  for (const d of dates) {
    let assets = 0, invested = 0, any = false;
    const px = {};
    for (const g of eligible) {
      const pos = posAt(timelines.get(g.gkey), d);
      if (pos.openQty <= 1e-10) continue;
      const k = keyOf(g);
      const raw = filled[k] && filled[k][d];
      const h = hist[k];
      const rate = raw != null ? rateAt(h && h.ccy, d) : null;
      let p;
      if (raw != null && rate != null) {
        p = raw * rate;
        px[g.gkey] = { p, qty: pos.openQty };
      } else {
        /* ohne Historie: mit heutigem Kurs als konstantem Wert, nicht in der %-Kette */
        if (!(g.price > 0)) continue;
        p = g.price;
        flatNames.add(g.name || g.ref.symbol);
      }
      assets += pos.openQty * p;
      invested += pos.openCost;
      any = true;
    }
    let cash = 0;
    for (const g of cashGroups) cash += cashAtDate(g.ref, d) * (rateAt(g.ref.ccy || cur, d) ?? 1);
    let props = 0;
    for (const g of propGroups) {
      if (g.ref.buyDate && g.ref.buyDate > d) continue;
      const pv = propValueAt(g.ref, d);
      if (!(pv > 0)) continue;
      props += pv;
      px[`prop:${g.gkey}`] = { p: pv, qty: 1 };
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
    for (const b of bms) {
      const k = `td:${b.sym}`;
      const v = filled[k] && filled[k][d];
      const r = v != null ? rateAt(hist[k] && hist[k].ccy, d) : null;
      row[`bm_${b.id}`] = v != null && r != null ? v * r : null;
    }
    rows.push(row);
    prev = { d, px };
  }
  return { rows, flatNames };
}

/* Serien zusammenführen (inkrementeller Abruf): neue Tage überschreiben alte */
export function mergeSeries(oldSeries, newSeries) {
  return { ...(oldSeries || {}), ...(newSeries || {}) };
}
export const lastDateOf = (series) => {
  let best = "";
  for (const k in series || {}) if (k > best) best = k;
  return best;
};
export const firstDateOf = (series) => {
  let best = "";
  for (const k in series || {}) if (!best || k < best) best = k;
  return best;
};
