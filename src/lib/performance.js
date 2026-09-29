/* ---------- Performance: offene + verkaufte Positionen ----------
   Reine Funktionen auf den Gruppen aus buildGroups (finance.js).
   Verkaufte Positionen bleiben in allen Kennzahlen enthalten, solange ihre
   Käufe und Verkäufe gespeichert sind – "Ausblenden" ändert daran nichts. */
import { VALUE_TYPES } from "./constants.jsx";
import { diffDays } from "./contracts.js";
import { isoDay } from "./utils.js";

/* Abgeschlossen = Wertpapier/Rohstoff ohne Restbestand, mit mindestens einem Verkauf */
export const isClosed = (g) =>
  !!g && !VALUE_TYPES.includes(g.type) && (Number(g.qty) || 0) <= 1e-9 && (g.sells || []).length > 0;

/* Abgeltungsteuer-relevant (vereinfacht): Aktien und ETFs. Krypto und Edelmetalle
   sind private Veräußerungsgeschäfte (§ 23 EStG) und zählen nicht zum Pauschbetrag. */
export const TAXABLE_TYPES = ["aktie", "etf"];
export const sparerPauschbetrag = (splitting) => (splitting ? 2000 : 1000);

const sum = (list, fn) => list.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
const yearOf = (iso) => String(iso || "").slice(0, 4);

/* Haltedauer lesbar: Tage, Monate oder Jahre */
export function holdLabel(days) {
  if (days == null || !isFinite(days)) return "–";
  if (days < 60) return `${Math.max(0, days)} Tage`;
  const m = Math.round(days / 30.44);
  if (m < 24) return `${m} Mon.`;
  return `${(m / 12).toFixed(1).replace(".", ",")} J.`;
}

/* Kennzahlen einer (verkauften) Position */
export function tradeStats(g, divs = []) {
  const matches = g.matches || [];
  const cost = sum(matches, (m) => m.cost);
  const proceeds = sum(matches, (m) => m.proceeds);
  const realized = Number(g.realized) || 0;
  const pct = cost > 0 ? (realized / cost) * 100 : null;
  const buyDates = (g.lots || []).map((l) => l.buyDate).filter(Boolean).sort();
  const sells = [...(g.sells || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const firstBuy = buyDates[0] || "";
  const lastSell = sells.length ? sells[sells.length - 1].date || "" : "";
  const holdDays = firstBuy && lastSell ? diffDays(firstBuy, lastSell) : null;
  /* p. a. erst ab 60 Tagen Haltedauer – darunter wäre die Hochrechnung irreführend */
  const growth = cost > 0 ? (cost + realized) / cost : 0;
  const pa = holdDays != null && holdDays >= 60 && growth > 0 ? (Math.pow(growth, 365.25 / holdDays) - 1) * 100 : null;
  const divSum = sum(divs.filter((d) => d.gkey === g.gkey), (d) => d.amt);

  /* Seit Verkauf: nur mit einem Kurs, der NACH dem letzten Verkauf abgerufen wurde */
  let since = null;
  const price = Number(g.price) || 0;
  const updated = g.ref && g.ref.priceUpdated ? isoDay(g.ref.priceUpdated) : "";
  if (sells.length && price > 0 && updated && lastSell && updated > lastSell) {
    const last = sells[sells.length - 1];
    const lastPrice = Number(last.price) || 0;
    const ifHeld = sum(sells, (s) => (Number(s.qty) || 0) * (price - (Number(s.price) || 0)));
    since = {
      price,
      lastPrice,
      pct: lastPrice > 0 ? (price / lastPrice - 1) * 100 : null,
      ifHeld,
      asOf: updated,
    };
  }
  return { cost, proceeds, realized, pct, pa, firstBuy, lastSell, holdDays, divSum, since, sells };
}

/* Gesamtbilanz: offen + realisiert + Ausschüttungen, je Jahr und je Position */
export function perfSummary(groups = [], divs = []) {
  const unreal = sum(groups, (g) => g.unreal);
  const realized = sum(groups, (g) => g.realized);
  const divTotal = sum(divs, (d) => d.amt);
  const invested = sum(groups.filter((g) => g.type !== "cash"), (g) => sum(g.lots || [], (l) => (Number(l.qty) || 0) * (Number(l.buyPrice) || 0)));

  const byYear = {};
  const bucket = (y) => (byYear[y] = byYear[y] || { realized: 0, taxable: 0, divs: 0 });
  for (const g of groups) {
    for (const m of g.matches || []) {
      const y = yearOf(m.date);
      if (!/^\d{4}$/.test(y)) continue;
      const b = bucket(y);
      b.realized += Number(m.realized) || 0;
      if (TAXABLE_TYPES.includes(g.type)) b.taxable += Number(m.realized) || 0;
    }
  }
  for (const d of divs) {
    const y = yearOf(d.date);
    if (/^\d{4}$/.test(y)) bucket(y).divs += Number(d.amt) || 0;
  }
  const years = Object.keys(byYear).sort();

  const divBy = {};
  for (const d of divs) divBy[d.gkey] = (divBy[d.gkey] || 0) + (Number(d.amt) || 0);
  const contributors = groups
    .filter((g) => g.type !== "cash")
    .map((g) => ({
      gkey: g.gkey,
      name: g.name,
      type: g.type,
      ref: g.ref,
      closed: isClosed(g),
      total: (Number(g.unreal) || 0) + (Number(g.realized) || 0) + (divBy[g.gkey] || 0),
    }))
    .filter((c) => Math.abs(c.total) >= 0.005)
    .sort((a, b) => b.total - a.total);

  return { unreal, realized, divTotal, total: unreal + realized + divTotal, invested, byYear, years, contributors };
}
