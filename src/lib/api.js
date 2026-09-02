/* ---------- Externe Kursquellen ----------
   Alle Netzzugriffe der App an einer Stelle. */
import { isoDay } from "./utils.js";
import { TICKER_DOMAINS, CRYPTO_MAX_DAYS } from "./constants.jsx";

/* USD → Zielwährung, mit Fallback-Quelle (frankfurter.app ist unzuverlässig geworden) */
export async function fetchUsdRate(target) {
  if (target === "USD") return 1;
  try {
    const j = await fetch(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${target}`).then((r) => r.json());
    if (j && j.rates && j.rates[target]) return j.rates[target];
  } catch { /* Fallback unten */ }
  try {
    const j = await fetch("https://open.er-api.com/v6/latest/USD").then((r) => r.json());
    if (j && j.rates && j.rates[target]) return j.rates[target];
  } catch { /* beide down */ }
  return 0;
}

/* Generischer Wechselkurs from->to (frankfurter.dev, Fallback er-api) */
export async function fetchFx(from, to) {
  if (!from || !to || from === to) return 1;
  try {
    const j = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`).then((r) => r.json());
    if (j && j.rates && j.rates[to]) return j.rates[to];
  } catch { /* Fallback */ }
  try {
    const j = await fetch(`https://open.er-api.com/v6/latest/${from}`).then((r) => r.json());
    if (j && j.rates && j.rates[to]) return j.rates[to];
  } catch { /* down */ }
  return 0;
}

/* Aktien/ETFs: Twelve Data (Tageswerte, Originalwährung) */
export async function fetchStockHistory(sym, key, startIso) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=1day&start_date=${startIso}&outputsize=5000&apikey=${key}`;
  const j = await fetch(url).then((r) => r.json());
  if (!j || !Array.isArray(j.values)) {
    const msg = (j && j.message) || "";
    if (/Grow|Venture|Pro plan/i.test(msg)) throw new Error("PLAN");
    if (j && j.code === 429) throw new Error("LIMIT");
    throw new Error("NODATA");
  }
  const series = {};
  for (const v of j.values) series[v.datetime] = Number(v.close);
  return { ccy: (j.meta && j.meta.currency) || "USD", series };
}

/* Krypto: CoinGecko (direkt in Zielwährung, max. 365 Tage gratis) */
export async function fetchCryptoHistory(coinId, cur, days) {
  const d = Math.min(Math.max(days, 2), CRYPTO_MAX_DAYS);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=${cur.toLowerCase()}&days=${d}&interval=daily`;
  const j = await fetch(url).then((r) => r.json());
  if (!j || !Array.isArray(j.prices)) throw new Error("NODATA");
  const series = {};
  for (const [ts, p] of j.prices) series[isoDay(ts)] = Number(p);
  return { ccy: cur, series };
}

/* Historische Wechselkurse (ein Request für den ganzen Zeitraum) */
export async function fetchFxSeries(from, to, startIso) {
  if (from === to) return null;
  const j = await fetch(`https://api.frankfurter.dev/v1/${startIso}..?base=${from}&symbols=${to}`).then((r) => r.json());
  if (!j || !j.rates) throw new Error("NOFX");
  const series = {};
  for (const [d, o] of Object.entries(j.rates)) series[d] = o[to];
  return series;
}

/* Serie auf einen Tagesraster legen und Lücken (Wochenenden) fortschreiben */
export function fillForward(series, dates) {
  const out = {};
  let last = null;
  for (const d of dates) {
    if (series[d] != null) last = series[d];
    if (last != null) out[d] = last;
  }
  return out;
}

/* Mehrere Symbole in EINEM Request (Twelve Data liefert dann ein Objekt je Symbol) */
export async function fetchStockHistories(syms, key, startIso) {
  if (syms.length === 1) return { [syms[0]]: await fetchStockHistory(syms[0], key, startIso) };
  const url = `https://api.twelvedata.com/time_series?symbol=${syms.map(encodeURIComponent).join(",")}&interval=1day&start_date=${startIso}&outputsize=5000&apikey=${key}`;
  const j = await fetch(url).then((r) => r.json());
  if (!j || typeof j !== "object") throw new Error("NODATA");
  if (j.code === 429) throw new Error("LIMIT");
  const out = {};
  for (const s of syms) {
    const part = j[s];
    if (!part || !Array.isArray(part.values)) {
      const msg = (part && part.message) || (j.message || "");
      out[s] = { error: /Grow|Venture|Pro plan/i.test(msg) ? "PLAN" : "NODATA" };
      continue;
    }
    const series = {};
    for (const v of part.values) series[v.datetime] = Number(v.close);
    out[s] = { ccy: (part.meta && part.meta.currency) || "USD", series };
  }
  return out;
}

/* ---------- Asset-Logo mit Fallback-Kette ----------
   Bewusst kurz gehalten: jeder Dienst hier sieht deine Ticker. */
export function logoCandidates(inv) {
  const sym = (inv.symbol || "").trim().toUpperCase();
  const list = [];
  if (inv.logoUrl) list.push(inv.logoUrl);
  if (!sym) return list;
  if (inv.type === "krypto") {
    list.push(`https://assets.parqet.com/logos/crypto/${encodeURIComponent(sym)}?format=png`);
  } else {
    list.push(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(sym)}?format=png`);
    const domain = TICKER_DOMAINS[sym];
    if (domain) list.push(`https://logo.clearbit.com/${domain}`);
  }
  return list;
}
