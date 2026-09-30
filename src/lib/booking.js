/* ---------- Buchungen ----------
   Verkäufe, Ausschüttungen, Cash-Bewegungen, Sondertilgungen und Positions-Änderungen
   als reine Funktionen: Datenstand rein → neuer Datenstand raus. App.jsx ruft sie nur
   noch in setData/withUndo auf – damit sind sie ohne React testbar. */
import { uid } from "./utils.js";
import { gkeyOf } from "./finance.js";

const n = (v) => Number(v) || 0;

/* ---------- Cash-Konto ----------
   Erlöse und Ausschüttungen landen auf dem Konto in der Anzeigewährung (ohne eigene
   Währung = Anzeigewährung). Fehlt es, wird es angelegt. */
const isCashIn = (x, cur) => x.type === "cash" && (x.ccy || cur) === cur;

export function addCashFlow(investments, { cur, flow, create = true, clampZero = false }) {
  const idx = investments.findIndex((x) => isCashIn(x, cur));
  if (idx < 0) {
    if (!create) return investments;
    return [...investments, {
      id: uid(), type: "cash", name: `Cash ${cur}`, ccy: cur, symbol: "",
      qty: 1, price: flow.amt, buyPrice: flow.amt, inChart: true, flows: [flow],
    }];
  }
  return investments.map((x, k) => {
    if (k !== idx) return x;
    let v = n(x.price) + flow.amt;
    if (clampZero) v = Math.max(0, v);
    return { ...x, price: v, buyPrice: v, flows: [...(x.flows || []), flow] };
  });
}

/* Buchung mit dieser ID aus dem Cash-Konto nehmen (Betrag wird zurückgerechnet) */
export function removeFlowById(investments, flowId, { clampZero = false } = {}) {
  return investments.map((x) => {
    if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === flowId)) return x;
    const back = n((x.flows.find((f) => f.id === flowId) || {}).amt);
    let v = n(x.price) - back;
    if (clampZero) v = Math.max(0, v);
    return { ...x, price: v, buyPrice: v, flows: x.flows.filter((f) => f.id !== flowId) };
  });
}

/* Betrag/Datum einer bestehenden Buchung ändern – der Kontostand zieht mit */
export function updateFlowById(investments, flowId, { amt, d }) {
  return investments.map((x) => {
    if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === flowId)) return x;
    const old = x.flows.find((f) => f.id === flowId);
    const nextAmt = amt == null ? n(old.amt) : amt;
    const v = n(x.price) - n(old.amt) + nextAmt;
    return { ...x, price: v, buyPrice: v, flows: x.flows.map((f) => (f.id === flowId ? { ...f, amt: nextAmt, d: d || f.d } : f)) };
  });
}

/* ---------- Verkäufe ---------- */
export function bookSell(d, gkey, s, { cur, id = uid(), toCash = true } = {}) {
  const date = s.date;
  const sell = { id, gkey, qty: n(s.qty), price: n(s.price), date };
  const investments = toCash ? addCashFlow(d.investments, { cur, flow: { id, d: date, amt: sell.qty * sell.price } }) : d.investments;
  return { ...d, sells: [...(d.sells || []), sell], investments };
}

export function updateSell(d, id, s) {
  const old = (d.sells || []).find((x) => x.id === id);
  if (!old) return d;
  const next = { ...old, qty: n(s.qty), price: n(s.price), date: s.date || old.date };
  /* Die Buchung kann in einer anderen Währung stehen (Konto nach Währungswechsel) –
     darum im Verhältnis anpassen statt den neuen Erlös direkt einzutragen */
  const oldProceeds = n(old.qty) * n(old.price);
  const newProceeds = next.qty * next.price;
  const investments = d.investments.map((x) => {
    if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === id)) return x;
    const fl = x.flows.find((f) => f.id === id);
    const amt = oldProceeds > 0 ? n(fl.amt) * (newProceeds / oldProceeds) : newProceeds;
    return updateFlowById([x], id, { amt, d: next.date })[0];
  });
  return { ...d, sells: d.sells.map((x) => (x.id === id ? next : x)), investments };
}

export function removeSell(d, id) {
  if (!(d.sells || []).some((x) => x.id === id)) return d;
  return { ...d, sells: d.sells.filter((x) => x.id !== id), investments: removeFlowById(d.investments, id) };
}

/* ---------- Ausschüttungen ----------
   amt = Gutschrift (nach Steuern), tax = einbehaltene Steuer (optional). */
export function bookDiv(d, gkey, v, { cur, id = uid() } = {}) {
  const amt = n(v.amt);
  const tax = Math.max(0, n(v.tax));
  const div = { id, gkey, amt, date: v.date, ...(tax > 0 ? { tax } : {}) };
  const investments = v.toCash ? addCashFlow(d.investments, { cur, flow: { id, d: v.date, amt } }) : d.investments;
  return { ...d, divs: [...(d.divs || []), div], investments };
}

export function removeDiv(d, id) {
  return { ...d, divs: (d.divs || []).filter((x) => x.id !== id), investments: removeFlowById(d.investments, id) };
}

/* ---------- Cash-Bewegungen ---------- */
export function bookCashFlow(d, cashId, amt, date, label, id = uid()) {
  return {
    ...d,
    investments: d.investments.map((x) => {
      if (x.id !== cashId) return x;
      const v = Math.max(0, n(x.price) + amt);
      return { ...x, price: v, buyPrice: v, flows: [...(x.flows || []), { id, d: date, amt, label }] };
    }),
  };
}

export function removeCashFlow(d, cashId, flowId) {
  return {
    ...d,
    investments: d.investments.map((x) => {
      if (x.id !== cashId) return x;
      const fl = (x.flows || []).find((f) => f.id === flowId);
      if (!fl) return x;
      const v = Math.max(0, n(x.price) - n(fl.amt));
      return { ...x, price: v, buyPrice: v, flows: x.flows.filter((f) => f.id !== flowId) };
    }),
  };
}

/* ---------- Sondertilgungen ---------- */
export function bookExtra(d, creditId, e, { cur, id = uid() } = {}) {
  const amt = n(e.amt);
  const credits = d.credits.map((c) => {
    if (c.id !== creditId) return c;
    const bal = Math.max(0, n(c.balance) - amt);
    return { ...c, balance: Math.round(bal * 100) / 100, extras: [...(c.extras || []), { id, d: e.date, amt, fromCash: !!e.fromCash }] };
  });
  const investments = e.fromCash
    ? addCashFlow(d.investments, { cur, flow: { id, d: e.date, amt: -amt, label: "Sondertilgung" }, create: false, clampZero: true })
    : d.investments;
  return { ...d, credits, investments };
}

export function removeExtra(d, creditId, extraId) {
  return {
    ...d,
    credits: d.credits.map((c) => {
      if (c.id !== creditId) return c;
      const ex = (c.extras || []).find((x) => x.id === extraId);
      if (!ex) return c;
      return { ...c, balance: Math.round((n(c.balance) + n(ex.amt)) * 100) / 100, extras: c.extras.filter((x) => x.id !== extraId) };
    }),
    /* kam die Tilgung vom Cash-Konto, geht der Betrag dorthin zurück */
    investments: removeFlowById(d.investments, extraId),
  };
}

/* ---------- Positionen ---------- */
export const removeLot = (d, id) => ({ ...d, investments: d.investments.filter((x) => x.id !== id) });

export function removeGroup(d, gkey) {
  return {
    ...d,
    archived: (d.archived || []).filter((x) => x !== gkey),
    investments: d.investments.filter((x) => gkeyOf(x) !== gkey),
    sells: (d.sells || []).filter((x) => x.gkey !== gkey),
    divs: (d.divs || []).filter((x) => x.gkey !== gkey),
    /* ohne Position läuft auch der Sparplan nicht weiter */
    plans: (d.plans || []).filter((x) => x.gkey !== gkey),
  };
}

export function toggleArchive(d, gkey) {
  const list = d.archived || [];
  return { ...d, archived: list.includes(gkey) ? list.filter((x) => x !== gkey) : [...list, gkey] };
}

/* Stammdaten einer ganzen Position ändern (alle Käufe): Name, Kennung (Ticker/ISIN/WKN),
   Börse, Logo, Region, Chart-Häkchen. Ändert sich dadurch der Schlüssel (anderer Ticker
   oder Typ), ziehen Verkäufe, Ausschüttungen, Ausblendung und Sparplan mit um. */
export const ID_KEYS = ["isin", "wkn", "idType", "mic", "exchange"];
const ID_TYPES = ["aktie", "etf"];
export const POSITION_KEYS = ["type", "name", "symbol", "logoUrl", "region", "inChart", ...ID_KEYS];

export function savePosition(d, gkey, patch) {
  const lots = d.investments.filter((x) => gkeyOf(x) === gkey);
  if (!lots.length) return { data: d, gkey };
  const clean = {};
  for (const k of POSITION_KEYS) if (k in patch) clean[k] = patch[k];
  if (typeof clean.symbol === "string") clean.symbol = clean.symbol.trim().toUpperCase();
  const first = lots[0];
  const symChanged = "symbol" in clean && clean.symbol !== String(first.symbol || "").toUpperCase();
  const typeChanged = "type" in clean && clean.type !== first.type;
  const apply = (x) => {
    const next = { ...x, ...clean };
    for (const k of [...ID_KEYS, "region"]) if (next[k] === "" || next[k] == null) delete next[k];
    if (!ID_TYPES.includes(next.type)) for (const k of ID_KEYS) delete next[k];
    if (symChanged || typeChanged) {
      /* neue Kennung = alter Kurs gilt nicht mehr sicher: beim nächsten Abruf neu holen */
      for (const k of ["coinId", "dayPct", "dayPctAt", "qccy"]) delete next[k];
      next.priceUpdated = 0;
    }
    return next;
  };
  const ids = new Set(lots.map((l) => l.id));
  const investments = d.investments.map((x) => (ids.has(x.id) ? apply(x) : x));
  const newKey = gkeyOf(apply(first));
  const move = (k) => (k === gkey ? newKey : k);
  const tplOf = (p) => {
    const t = { ...(p.tpl || {}) };
    for (const k of ["type", "name", "symbol", "logoUrl", "region", ...ID_KEYS]) if (k in clean) t[k] = clean[k];
    for (const k of [...ID_KEYS, "region"]) if (t[k] === "" || t[k] == null) delete t[k];
    if (symChanged || typeChanged) delete t.coinId;
    return t;
  };
  return {
    gkey: newKey,
    data: {
      ...d,
      investments,
      sells: newKey === gkey ? d.sells : (d.sells || []).map((s) => ({ ...s, gkey: move(s.gkey) })),
      divs: newKey === gkey ? d.divs : (d.divs || []).map((s) => ({ ...s, gkey: move(s.gkey) })),
      archived: (d.archived || []).map(move),
      plans: (d.plans || []).map((p) => (p.gkey === gkey ? { ...p, gkey: newKey, tpl: tplOf(p) } : p)),
    },
  };
}

/* neue IDs für Einträge (Formulare, Kategorien, Ziele) */
export const newId = uid;
