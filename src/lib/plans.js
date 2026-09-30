/* ---------- Sparpläne ----------
   Ein Sparplan kauft in festem Rhythmus für einen festen Betrag. Jede fällige Ausführung
   wird als eigener Kauf (Lot) angelegt: Stückzahl = (Betrag − Gebühr) / Kurs am
   Ausführungstag, Einstand = Betrag (Gebühr zählt zum Kaufpreis). Verpasste Termine
   (App war zu) werden beim nächsten Öffnen nachgebucht. Ohne historischen Kurs wird der
   aktuelle Kurs genommen und der Kauf als "Kurs geschätzt" markiert – sobald die
   Kurshistorie da ist, rechnet repricePlanLots ihn nach. */
import { uid, addDays, isoDay } from "./utils.js";
import { histKeyOf } from "./finance.js";
import { priceOnOrBefore } from "./wealth.js";
import { lastDateOf } from "./portfolioSeries.js";

export const PLAN_INTERVALS = [
  { id: "monatlich", label: "monatlich", months: 1, per: "Monat" },
  { id: "zweimonatlich", label: "alle 2 Monate", months: 2, per: "2 Monate" },
  { id: "quartalsweise", label: "quartalsweise", months: 3, per: "Quartal" },
  { id: "halbjaehrlich", label: "halbjährlich", months: 6, per: "Halbjahr" },
  { id: "jaehrlich", label: "jährlich", months: 12, per: "Jahr" },
];
export const planInterval = (id) => PLAN_INTERVALS.find((x) => x.id === id) || PLAN_INTERVALS[0];

/* Monate zu einem ISO-Tag addieren; der Tag wird am Monatsende gekappt (31. → 30./28.) */
export function addMonthsIso(iso, months) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12), nm = idx % 12;
  const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, dim)).padStart(2, "0")}`;
}

/* Alle Termine eines Plans bis einschliesslich `to` */
export function planDates(plan, to) {
  if (!plan || !plan.start) return [];
  const step = planInterval(plan.interval).months;
  const out = [];
  for (let k = 0; k < 1200; k++) {
    const d = addMonthsIso(plan.start, k * step);
    if (d > to || (plan.end && d > plan.end)) break;
    out.push(d);
  }
  return out;
}

/* Noch nicht gebuchte, fällige Termine */
export function duePlanDates(plan, today) {
  if (!plan || plan.active === false) return [];
  return planDates(plan, today).filter((d) => !plan.lastRun || d > plan.lastRun);
}

/* Nächster Termin nach heute (für die Anzeige) */
export function nextPlanDate(plan, today) {
  if (!plan || !plan.start || plan.active === false) return "";
  const step = planInterval(plan.interval).months;
  for (let k = 0; k < 1200; k++) {
    const d = addMonthsIso(plan.start, k * step);
    if (plan.end && d > plan.end) return "";
    if (d > today && (!plan.lastRun || d > plan.lastRun)) return d;
  }
  return "";
}

const qtyRound = (q) => Number(q.toFixed(8));

/* Fällige Ausführungen buchen. priceAt(plan, date) → { price, est } | null.
   Fehlt ein Kurs, bleibt der Termin offen und wird beim nächsten Lauf versucht. */
export function runPlans(d, today, priceAt, { currentPrice } = {}) {
  const plans = d.plans || [];
  if (!plans.length) return d;
  let changed = false;
  const created = [];
  const nextPlans = plans.map((p) => {
    const dates = duePlanDates(p, today);
    if (!dates.length) return p;
    const amount = Number(p.amount) || 0;
    const net = Math.max(0, amount - (Number(p.fee) || 0));
    if (!(net > 0)) return p;
    let last = p.lastRun || "";
    for (const date of dates) {
      const px = priceAt(p, date);
      if (!px || !(px.price > 0)) break;
      const qty = qtyRound(net / px.price);
      if (!(qty > 0)) break;
      const now = currentPrice ? currentPrice(p) : 0;
      created.push({
        ...p.tpl,
        id: uid(),
        qty,
        buyPrice: amount / qty,
        /* Betrag und Gebühr dieser Ausführung – ein späteres Nachrechnen nutzt sie,
           auch wenn der Plan inzwischen einen anderen Betrag hat */
        planAmt: amount,
        ...(Number(p.fee) > 0 ? { planFee: Number(p.fee) } : {}),
        price: now > 0 ? now : px.price,
        buyDate: date,
        inChart: true,
        plan: p.id,
        ...(px.est ? { est: true } : {}),
      });
      last = date;
    }
    if (last === (p.lastRun || "")) return p;
    changed = true;
    return { ...p, lastRun: last };
  });
  if (!changed) return d;
  return { ...d, plans: nextPlans, investments: [...d.investments, ...created] };
}

/* Geschätzte Sparplan-Käufe mit echtem historischem Kurs nachrechnen.
   Nicht, wenn danach schon verkauft wurde – sonst verschöbe sich die FIFO-Rechnung. */
export function repricePlanLots(d, priceAt, gkeyOfLot) {
  const plans = new Map((d.plans || []).map((p) => [p.id, p]));
  let changed = false;
  const investments = d.investments.map((l) => {
    if (!l.est || !l.plan || !plans.has(l.plan)) return l;
    const p = plans.get(l.plan);
    const gk = gkeyOfLot(l);
    if ((d.sells || []).some((s) => s.gkey === gk && (s.date || "") >= (l.buyDate || ""))) return l;
    const px = priceAt(p, l.buyDate);
    if (!px || px.est || !(px.price > 0)) return l;
    const amount = l.planAmt != null ? Number(l.planAmt) || 0 : Number(p.amount) || 0;
    const net = Math.max(0, amount - (l.planAmt != null ? Number(l.planFee) || 0 : Number(p.fee) || 0));
    const qty = qtyRound(net / px.price);
    if (!(qty > 0)) return l;
    changed = true;
    const { est: _est, ...rest } = l;
    return { ...rest, qty, buyPrice: amount / qty };
  });
  return changed ? { ...d, investments } : d;
}

/* Kennzahlen eines Plans aus seinen Käufen */
export function planStats(plan, lots) {
  const mine = lots.filter((l) => l.plan === plan.id);
  const qty = mine.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const invested = mine.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.buyPrice) || 0), 0);
  return { runs: mine.length, qty, invested, avg: qty > 0 ? invested / qty : 0, est: mine.filter((l) => l.est).length };
}

/* Stammdaten der Position, die jeder Sparplan-Kauf erbt */
export const TPL_KEYS = ["type", "name", "symbol", "logoUrl", "isin", "wkn", "idType", "mic", "exchange", "coinId", "commodity", "unit", "region"];
export function tplOf(src) {
  const t = {};
  for (const k of TPL_KEYS) if (src[k] != null && src[k] !== "") t[k] = src[k];
  return t;
}

export function makePlan({ gkey, tpl, amount, fee, interval, start, end }) {
  return {
    id: uid(), gkey, tpl, amount: Number(amount) || 0,
    ...(Number(fee) > 0 ? { fee: Number(fee) } : {}),
    interval: planInterval(interval).id, start, ...(end ? { end } : {}),
    active: true, lastRun: "",
  };
}

/* Kurs für eine Ausführung am Tag `date`:
   - letzte 3 Tage: aktueller Kurs – exakt nur, wenn er am/nach dem Termin geholt wurde,
     sonst als Schätzung markiert (ein Kurs von vor Wochen wäre sonst still gebucht)
   - ältere Termine: Kurshistorie, aber nur wenn sie bis an den Termin heranreicht
     (4 Tage Luft für Wochenenden); Fremdwährung mit dem Kurs des Tages
   - sonst: aktueller Kurs als Schätzung (wird später per Historie nachgerechnet) */
export function planPricer({ groups = [], hist = {}, fxRates = {}, cur = "EUR", today }) {
  const recent = addDays(today, -3);
  const groupOf = (p) => groups.find((x) => x.gkey === p.gkey);
  const current = (p) => { const g = groupOf(p); return g && g.price > 0 ? g.price : Number(p.px) || 0; };
  const currentDay = (p) => {
    const g = groupOf(p);
    const ts = g && g.price > 0 ? (g.ref && g.ref.priceUpdated) || 0 : Number(p.pxAt) || 0;
    return ts ? isoDay(ts) : "";
  };
  const priceAt = (p, date) => {
    const now = current(p);
    if (date >= recent) return now > 0 ? { price: now, ...(currentDay(p) >= date ? {} : { est: true }) } : null;
    /* Historie über die Live-Position (dort steht u. a. die CoinGecko-ID) */
    const key = histKeyOf(groupOf(p) || { type: p.tpl.type, ref: p.tpl }, cur);
    const ser = hist[key];
    const reaches = ser && ser.series && lastDateOf(ser.series) >= addDays(date, -4);
    const px = reaches ? priceOnOrBefore(ser.series, date) : null;
    if (px) {
      let rate = 1;
      if (ser.ccy && ser.ccy !== cur) {
        const fxs = hist[`fx:${ser.ccy}:${cur}`];
        rate = (fxs && fxs.series && priceOnOrBefore(fxs.series, date)) || fxRates[ser.ccy] || 0;
      }
      if (rate > 0) return { price: px * rate };
    }
    return now > 0 ? { price: now, est: true } : null;
  };
  return { priceAt, current };
}
