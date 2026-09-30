/* ---------- Vermögensverlauf (Übersicht) ----------
   Jeder Monat wird aus seinen Bausteinen neu berechnet (nie ein eingefrorener Wert):
     • Cash: exakter Stand am Stichtag · Wertpapiere: letzter Kurs ≤ Stichtag aus der
       Kurshistorie (ohne Historie: aktueller Kurs) · Immobilie: aktueller Wertansatz ab
       Kaufdatum · Kredite: Restschuld des Monats aus dem Snapshot.
   Die Kurs-Suche läuft per Binärsuche über vorsortierte Tage. */
import { HIST_TYPES } from "./constants.jsx";
import { fifoAt, cashAtDate, propValueAt, histKeyOf } from "./finance.js";
import { todayIso } from "./utils.js";

export function makeValuer({ groups = [], hist = {}, fxRates = {}, cur = "EUR" }) {
  const cash = groups.filter((g) => g.type === "cash");
  const props = groups.filter((g) => g.type === "immobilie");
  const stocks = groups.filter((g) => HIST_TYPES.includes(g.type));
  const sorted = new Map();
  const daysOf = (key) => {
    if (!sorted.has(key)) {
      const h = hist[key];
      sorted.set(key, h && h.series ? Object.keys(h.series).sort() : []);
    }
    return sorted.get(key);
  };
  const priceLE = (key, d) => {
    const days = daysOf(key);
    let lo = 0, hi = days.length - 1, best = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (days[m] <= d) { best = m; lo = m + 1; } else hi = m - 1; }
    return best < 0 ? null : hist[key].series[days[best]];
  };
  const cashAt = (d) => cash.reduce((s, g) => s + cashAtDate(g.ref, d) * (fxRates[g.ref.ccy || cur] || 1), 0);
  const propAt = (d) => props.reduce((s, g) => (g.ref.buyDate && g.ref.buyDate > d ? s : s + propValueAt(g.ref, d)), 0);
  const stockAt = (d) => stocks.reduce((sum, g) => {
    const pos = fifoAt(g.lots, g.sells, d);
    if (pos.openQty <= 1e-9) return sum;
    const key = histKeyOf(g, cur);
    const h = hist[key];
    let px = h && h.series ? priceLE(key, d) : null;
    let rate = h && h.ccy && h.ccy !== cur ? (fxRates[h.ccy] || 1) : 1;
    if (px == null) { px = Number(g.price) || 0; rate = 1; }
    return sum + pos.openQty * px * rate;
  }, 0);
  return { cashAt, propAt, stockAt, at: (d) => cashAt(d) + stockAt(d) + propAt(d) };
}

export const monthKeyOf = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/* Stichtag eines Monats: Monatsletzter, im laufenden Monat heute */
export function monthRef(m, current) {
  if (m === current) return todayIso();
  const [y, mm] = m.split("-").map(Number);
  return `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, "0")}`;
}

/* Letzte `months` Monate für den Chart */
export function wealthSeries({ valuer, snapshots = [], netWorth, creditBalance, months = 3, now = new Date() }) {
  const current = monthKeyOf(now);
  const out = [];
  for (let k = months - 1; k >= 0; k--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const m = monthKeyOf(dt);
    const snap = snapshots.find((s) => s.m === m);
    const debt = snap ? (Number(snap.debt) || 0) : Math.round(creditBalance);
    const net = m === current ? Math.round(netWorth) : Math.round(valuer.at(monthRef(m, current)) - debt);
    out.push({ m, net });
  }
  return out;
}

/* Nettovermögen eines vergangenen Monats (für "seit <Monat>") */
export function netAtSnapshot({ valuer, snap, netWorth, now = new Date() }) {
  const current = monthKeyOf(now);
  if (!snap) return null;
  if (snap.m === current) return netWorth;
  return valuer.at(monthRef(snap.m, current)) - (Number(snap.debt) || 0);
}

/* Letzter Kurs an oder vor einem Tag (einzelne Abfrage, z. B. Sparplan-Ausführung) */
export function priceOnOrBefore(series, d) {
  let best = null;
  for (const k in series || {}) if (k <= d && (best === null || k > best)) best = k;
  return best === null ? null : series[best];
}
