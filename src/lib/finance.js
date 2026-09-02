/* ---------- Finanzmathematik: Kredite, FIFO, Gruppen, Immobilienwert ----------
   Reine Funktionen ohne React und ohne Netz – vollständig per Vitest testbar. */
import { getCur } from "./currency.js";
import { todayIso, yearsBetween } from "./utils.js";

/* ---------- Kredite: Restlaufzeit, Zinsen, automatische Tilgung ---------- */
/* Tilgungsplan bis zur vollständigen Rückzahlung (max. 100 Jahre) */
export function payoffPlan(balance, rate, interestPct) {
  const bal0 = Number(balance) || 0;
  const r = Number(rate) || 0;
  const im = (Number(interestPct) || 0) / 100 / 12;
  if (bal0 <= 0) return { months: 0, interest: 0, ok: true };
  if (r <= 0) return { months: Infinity, interest: Infinity, ok: false };
  let bal = bal0, months = 0, interest = 0;
  while (bal > 0 && months < 1200) {
    const int = bal * im;
    const til = r - int;
    if (til <= 0) return { months: Infinity, interest: Infinity, ok: false };
    interest += int;
    bal = Math.max(0, bal - til);
    months++;
  }
  return { months, interest, ok: bal <= 0 };
}
/* Monate von heute bis zum hinterlegten Tilgungsschluss */
export function monthsUntil(iso) {
  if (!iso) return null;
  const end = new Date(iso);
  if (isNaN(end)) return null;
  const now = new Date();
  const m = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + (end.getDate() >= now.getDate() ? 0 : -1);
  return Math.max(0, m);
}
export const monthsLabel = (m) => {
  if (!isFinite(m)) return "läuft nie ab";
  if (m <= 0) return "abbezahlt";
  const y = Math.floor(m / 12), r = m % 12;
  return `${y ? `${y} J. ` : ""}${r ? `${r} Mon.` : y ? "" : "0 Mon."}`.trim();
};

/* Vollständiger Tilgungsplan. Nach Ende der Zinsbindung wird mit dem
   angenommenen Anschlusszins weitergerechnet (Refinanzierung). */
export function amortSchedule(credit) {
  const rate = Number(credit.rate) || 0;
  const i1 = (Number(credit.interest) || 0) / 100 / 12;
  const follow = credit.followInterest === "" || credit.followInterest == null ? credit.interest : credit.followInterest;
  const i2 = (Number(follow) || 0) / 100 / 12;
  const fixMonths = credit.fixedUntil ? monthsUntil(credit.fixedUntil) : null;
  let bal = Number(credit.balance) || 0;
  const rows = [];
  let m = 0, totalInterest = 0, balAtFix = null, stalled = false;
  const now = new Date();
  while (bal > 0 && m < 720) {
    const im = fixMonths == null || m < fixMonths ? i1 : i2;
    const int = bal * im;
    if (rate - int <= 0) { stalled = true; break; }
    const pay = Math.min(rate, bal + int);
    const principal = pay - int;
    bal = Math.max(0, bal - principal);
    totalInterest += int;
    m++;
    const dt = new Date(now.getFullYear(), now.getMonth() + m, 1);
    rows.push({ m, year: dt.getFullYear(), label: `${dt.getFullYear()}`, interest: int, principal, bal });
    if (fixMonths != null && m === fixMonths) balAtFix = bal;
  }
  const years = [];
  for (const r of rows) {
    let y = years.find((x) => x.year === r.year);
    if (!y) { y = { year: r.year, interest: 0, principal: 0, bal: r.bal }; years.push(y); }
    y.interest += r.interest;
    y.principal += r.principal;
    y.bal = r.bal;
  }
  return { rows, years, months: m, totalInterest, balAtFix, fixMonths, paidOff: bal <= 0, stalled };
}

/* Fällige Monatsraten nachbuchen – rein, damit sie überall aufgerufen werden kann */
export function applyDueCredits(d) {
  let changed = false;
  const credits = (d.credits || []).map((c) => {
    if (!c.paymentDay || !(Number(c.rate) > 0) || !(Number(c.balance) > 0)) return c;
    const now = new Date();
    /* Zahltag 31 in einem 30-Tage-Monat: am letzten Tag des Monats fällig */
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const due = Math.min(Number(c.paymentDay), dim);
    const curIdx = now.getFullYear() * 12 + now.getMonth() - (now.getDate() < due ? 1 : 0);
    if (typeof c.lastAppliedIdx !== "number") { changed = true; return { ...c, lastAppliedIdx: curIdx }; }
    if (c.lastAppliedIdx >= curIdx) return c;
    let bal = Number(c.balance);
    let last = c.lastAppliedIdx;
    while (last < curIdx && bal > 0) {
      const interest = c.interest ? (bal * (Number(c.interest) / 100)) / 12 : 0;
      const tilgung = Math.max(0, Number(c.rate) - interest);
      bal = Math.max(0, bal - tilgung);
      last++;
    }
    changed = true;
    return { ...c, balance: Math.round(bal * 100) / 100, lastAppliedIdx: curIdx };
  });
  return changed ? { ...d, credits } : d;
}

/* ---------- Positionen gruppieren, FIFO, Cash ---------- */
/* Gleiches Asset = gleicher Schlüssel; Cash und Immobilien bleiben je Eintrag eigenständig. */
export function gkeyOf(i) {
  if (i.type === "cash") return `cash:${i.id}`;
  if (i.type === "immobilie") return `immobilie:${(i.name || i.id).toUpperCase()}`;
  if (i.type === "rohstoff") return `rohstoff:${(i.commodity || i.symbol || "").toUpperCase()}`;
  return `${i.type}:${(i.symbol || i.name || "").toUpperCase()}`;
}

/* FIFO: Verkäufe gegen die ältesten Käufe rechnen */
export function fifo(lots, sells) {
  const open = lots
    .map((l) => ({ id: l.id, qty: Number(l.qty) || 0, price: Number(l.buyPrice) || 0, date: l.buyDate || "" }))
    .sort((a, b) => (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31"));
  const ss = [...sells].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let realized = 0, soldQty = 0;
  const matches = [];
  for (const s of ss) {
    const sQty = Number(s.qty) || 0;
    const sPrice = Number(s.price) || 0;
    let rest = sQty, cost = 0, matched = 0;
    for (const l of open) {
      if (rest <= 1e-10) break;
      if (l.qty <= 1e-10) continue;
      const take = Math.min(l.qty, rest);
      cost += take * l.price;
      l.qty -= take; rest -= take; matched += take;
    }
    soldQty += sQty;
    const g = matched * sPrice - cost;
    realized += g;
    matches.push({ id: s.id, date: s.date, qty: sQty, price: sPrice, proceeds: sQty * sPrice, cost, realized: g });
  }
  const openQty = open.reduce((a, l) => a + l.qty, 0);
  const openCost = open.reduce((a, l) => a + l.qty * l.price, 0);
  return { open, openQty, openCost, realized, soldQty, matches };
}

/* Bestand und Einstandswert an einem Stichtag (für den Chart) */
export function fifoAt(lots, sells, d) {
  return fifo(
    lots.filter((l) => (l.buyDate || "") && l.buyDate <= d),
    sells.filter((s) => (s.date || "") <= d),
  );
}

export const cashAmount = (i) => Number(i.price) || 0;
export const cashValue = (i, fx) => cashAmount(i) * (fx[i.ccy || getCur()] || 1);
/* Cash-Stand an einem Stichtag: heutiger Betrag minus alle späteren Zuflüsse */
export function cashAtDate(i, d) {
  const flows = Array.isArray(i.flows) ? i.flows : [];
  return cashAmount(i) - flows.filter((f) => (f.d || "") > d).reduce((a, f) => a + (Number(f.amt) || 0), 0);
}

/* Wert einer Immobilie an einem Stichtag.
   Modus "rate": Kaufpreis ab Kaufdatum mit der AKTUELLEN Rate p. a. verzinst.
   Die Rate gilt fuer die komplette Historie ab Kauf - aendert man sie, wird der
   ganze Verlauf mit der neuen Rate gerechnet (keine Zwischenspeicherung alter
   Werte). Bei 0 % ist der Wert konstant = Kaufpreis.
   Modus "value": glatte Entwicklung vom Kaufpreis zum heute eingetragenen Wert. */
export function propValueAt(i, d) {
  const base = Number(i.buyPrice) || Number(i.price) || 0;
  const start = i.buyDate || "";
  if ((i.valMode || "value") === "rate") {
    const r = (Number(i.growth) || 0) / 100;
    if (start) {
      const y = Math.max(0, yearsBetween(start, d));
      return base * Math.pow(1 + r, y);
    }
    /* kein Kaufdatum: vom heutigen Wert mit derselben Rate zurückrechnen */
    const now = Number(i.price) || base;
    return now * Math.pow(1 + r, yearsBetween(todayIso(), d));
  }
  const now = Number(i.price) || base;
  if (!start || base <= 0 || now <= 0) return now;
  const yTot = yearsBetween(start, todayIso());
  if (yTot <= 0) return now;
  const y = Math.min(Math.max(0, yearsBetween(start, d)), yTot);
  return base * Math.pow(now / base, y / yTot);
}

/* Alle Positionen zu Gruppen zusammenfassen */
export function buildGroups(investments, sells, fx) {
  const map = new Map();
  for (const i of investments) {
    const k = gkeyOf(i);
    if (!map.has(k)) map.set(k, { gkey: k, type: i.type, name: i.name, ref: i, lots: [], sells: [] });
    const g = map.get(k);
    g.lots.push(i);
    if ((Number(i.price) || 0) > 0 && (i.priceUpdated || 0) >= (g.ref.priceUpdated || 0)) g.ref = i;
  }
  for (const s of sells || []) {
    const g = map.get(s.gkey);
    if (g) g.sells.push(s);
  }
  const out = [];
  for (const g of map.values()) {
    g.price = Number(g.ref.price) || 0;
    /* Immobilien mit Wachstumsrate wachsen mit der Zeit weiter */
    if (g.type === "immobilie") g.price = propValueAt(g.ref, todayIso());
    g.inChart = g.lots.some((l) => l.inChart !== false);
    if (g.type === "cash") {
      g.qty = 1;
      g.value = cashValue(g.ref, fx);
      g.cost = g.value;
      g.realized = 0;
      g.unreal = 0;
    } else {
      const f = fifo(g.lots, g.sells);
      g.qty = f.openQty;
      g.cost = f.openCost;
      g.realized = f.realized;
      g.soldQty = f.soldQty;
      g.matches = f.matches;
      g.value = g.qty * g.price;
      g.unreal = g.value - g.cost;
    }
    g.gain = g.unreal + g.realized;
    g.avgBuy = g.qty > 0 ? g.cost / g.qty : 0;
    out.push(g);
  }
  return out;
}

export const monthly = (item) =>
  item.interval === "jaehrlich" ? (Number(item.amount) || 0) / 12 : Number(item.amount) || 0;

/* Datenschlüssel einer Gruppe im Historien-Cache */
export const histKeyOf = (g, cur) => g.type === "krypto"
  ? `cg:${g.ref.coinId || (g.ref.symbol || "").toUpperCase()}:${cur}`
  : `td:${(g.ref.symbol || "").toUpperCase()}`;
