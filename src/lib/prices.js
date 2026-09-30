/* ---------- Live-Kurse ----------
   Krypto → CoinGecko (ohne Key) · US-Aktien/ETFs → Finnhub · alles andere (EU-Börsen,
   per ISIN/WKN gewählte Notierungen, Öl) → Twelve Data · Edelmetalle → gold-api.
   fetchQuotes holt nur und schreibt nichts; applyQuotes setzt die Kurse rein funktional
   in die Positionen. fetch/sleep/fx sind austauschbar (Tests). */
import { VALUE_TYPES, COMMODITIES, CRYPTO_IDS } from "./constants.jsx";
import { isUsMic } from "./identifiers.js";
import { fetchFx, normPrice } from "./api.js";
import { roundPrice } from "./currency.js";

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const symOf = (i) => (i.symbol || "").trim().toUpperCase();
const commodityOf = (i) => COMMODITIES.find((c) => c.id === i.commodity) || {};

/* Alles, was einen Marktpreis hat (nicht: Cash, Immobilien) */
export const priceableOf = (investments = []) => investments.filter((i) => !VALUE_TYPES.includes(i.type));

export async function fetchQuotes(items, { cur = "EUR", finnhubKey = "", tdKey = "", fetchImpl, sleep = defaultSleep, fx = fetchFx } = {}) {
  const get = fetchImpl || ((...a) => fetch(...a));
  const bySym = {};      /* SYMBOL → { price, dayPct, ccy } (Preis in Anzeigewährung) */
  const byId = {};       /* Position-ID → { … } (Rohstoffe) */
  const resolved = {};   /* SYMBOL → CoinGecko-ID */
  const failed = [];
  const notes = [];
  const curLow = cur.toLowerCase();

  /* Wechselkurse je Anfrage nur einmal holen */
  const fxCache = {};
  const fxTo = async (ccy) => {
    if (!ccy) return 0;
    if (ccy === cur) return 1;
    if (fxCache[ccy] == null) fxCache[ccy] = (await fx(ccy, cur)) || 0;
    return fxCache[ccy];
  };
  const dp = (v) => (typeof v === "number" && isFinite(v) ? v : null);

  /* --- Krypto: CoinGecko, direkt in der Anzeigewährung --- */
  const cryptos = items.filter((i) => i.type === "krypto");
  if (cryptos.length) {
    const symToId = {};
    for (const c of cryptos) {
      const s = symOf(c);
      if (symToId[s]) continue;
      let id = c.coinId || CRYPTO_IDS[s];
      if (!id) {
        try {
          const r = await get(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(s)}`);
          if (r.status === 429) { notes.push("CoinGecko-Limit erreicht – in 1 Min. erneut versuchen"); break; }
          const j = await r.json();
          id = ((j.coins || []).find((x) => (x.symbol || "").toUpperCase() === s) || {}).id;
          await sleep(400);
        } catch { /* unten als failed */ }
      }
      if (id) { symToId[s] = id; resolved[s] = id; } else failed.push(s);
    }
    const ids = [...new Set(Object.values(symToId))];
    if (ids.length) {
      try {
        const r = await get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${curLow}&include_24hr_change=true`);
        if (r.status === 429) notes.push("CoinGecko-Limit erreicht – in 1 Min. erneut versuchen");
        else {
          const j = await r.json();
          for (const [s, id] of Object.entries(symToId)) {
            const p = j[id] && j[id][curLow];
            if (p) bySym[s] = { price: p, dayPct: dp(j[id][`${curLow}_24h_change`]) };
            else failed.push(s);
          }
        }
      } catch { notes.push("CoinGecko nicht erreichbar"); }
    }
  }

  /* --- Aktien/ETFs: US-Notierungen über Finnhub (USD), Rest über Twelve Data --- */
  const stocks = items.filter((i) => i.type === "aktie" || i.type === "etf");
  const tdRetry = [];
  const seenStock = new Set();
  const uniqStocks = stocks.filter((s) => { const k = `${symOf(s)}|${s.mic || ""}`; if (seenStock.has(k)) return false; seenStock.add(k); return true; });
  if (uniqStocks.length) {
    if (finnhubKey) {
      const usd = await fxTo("USD");
      if (!usd) notes.push("Wechselkurs nicht erreichbar – Aktien übersprungen");
      else {
        let keyInvalid = false;
        for (const s of uniqStocks) {
          const sym = symOf(s);
          if (!isUsMic(s.mic)) { tdRetry.push(s); continue; }
          try {
            const res = await get(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${finnhubKey}`);
            if (res.status === 401 || res.status === 403) { keyInvalid = true; break; }
            if (res.status === 429) { notes.push("Finnhub-Limit erreicht – in 1 Min. erneut versuchen"); break; }
            const q = await res.json();
            if (q && q.c) bySym[sym] = { price: q.c * usd, dayPct: dp(q.dp), ccy: "USD" };
            else tdRetry.push(s);
            await sleep(250);
          } catch { tdRetry.push(s); }
        }
        if (keyInvalid) notes.push("Finnhub-Key ungültig – bitte in den Einstellungen prüfen");
      }
    } else tdRetry.push(...uniqStocks);
  }

  /* --- Edelmetalle: gold-api (USD je Unze) --- */
  const metals = items.filter((i) => i.type === "rohstoff" && commodityOf(i).src === "metal");
  if (metals.length) {
    const usd = await fxTo("USD");
    if (!usd) notes.push("Wechselkurs nicht erreichbar – Edelmetalle übersprungen");
    else {
      const bySymbol = {};
      for (const m of metals) {
        const def = commodityOf(m);
        try {
          if (!(def.sym in bySymbol)) bySymbol[def.sym] = await get(`https://api.gold-api.com/price/${def.sym}`).then((r) => r.json());
          const j = bySymbol[def.sym];
          if (j && j.price) byId[m.id] = { price: j.price * usd, ccy: "USD" };
          else failed.push(m.name);
        } catch { failed.push(m.name); }
      }
    }
  }

  /* --- Twelve Data: Nicht-US-Notierungen, ETFs per ISIN, Öl --- */
  const tdCommods = items.filter((i) => i.type === "rohstoff" && commodityOf(i).src === "td");
  if (tdRetry.length || tdCommods.length) {
    if (!tdKey) {
      if (tdRetry.length) notes.push("Für EU-Aktien/ETFs & Öl: Twelve-Data-Key in den Einstellungen hinterlegen");
      else notes.push("Für Öl: Twelve-Data-Key in den Einstellungen hinterlegen");
      for (const s of tdRetry) failed.push(symOf(s));
    } else {
      const quote = async (sym, mic) => {
        const m = mic ? `&mic_code=${encodeURIComponent(mic)}` : "";
        return get(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}${m}&apikey=${tdKey}`).then((r) => r.json());
      };
      /* Ein Kurs aus einer TD-Antwort – Pence & Co. werden in die Hauptwährung umgerechnet */
      const take = async (q, fallbackCcy) => {
        const raw = q && q.close != null ? Number(q.close) : null;
        if (!raw) return null;
        const n = normPrice(raw, q.currency || fallbackCcy);
        const r = await fxTo(n.ccy);
        if (!r) return false;
        const ch = Number(q.percent_change);
        return { price: n.price * r, dayPct: isFinite(ch) ? ch : null, ccy: n.ccy };
      };
      let limit = false;
      for (const s of tdRetry) {
        const sym = (s.symbol || "").trim();
        try {
          const q = await quote(sym, s.mic);
          const t = await take(q, "");
          if (t) bySym[sym.toUpperCase()] = t;
          else if (t === false) failed.push(sym);
          else if (q && q.code === 429) { notes.push("Twelve-Data-Limit erreicht – in 1 Min. erneut versuchen"); limit = true; break; }
          else if (q && /Grow|Venture/i.test(q.message || "")) failed.push(`${sym} (EU-Börse nur im kostenpflichtigen Plan)`);
          else failed.push(`${sym} (nicht gefunden)`);
          await sleep(350);
        } catch { failed.push(sym); }
      }
      for (const m of limit ? [] : tdCommods) {
        const def = commodityOf(m);
        try {
          const q = await quote(def.sym, "");
          const t = await take(q, "USD");
          if (t) byId[m.id] = t;
          else if (t === false) failed.push(m.name);
          else if (q && q.code === 429) { notes.push("Twelve-Data-Limit erreicht – in 1 Min. erneut versuchen"); break; }
          else if (q && /Grow|Venture/i.test(q.message || "")) failed.push(`${m.name} (nur im kostenpflichtigen Plan)`);
          else failed.push(m.name);
          await sleep(350);
        } catch { failed.push(m.name); }
      }
    }
  }
  return { bySym, byId, resolved, failed, notes };
}

/* Kurse übernehmen (rein): Preis, Zeitstempel, Tagesveränderung, Handelswährung, CoinGecko-ID */
export function applyQuotes(investments, res, now = Date.now()) {
  const { bySym = {}, byId = {}, resolved = {} } = res || {};
  let changed = false;
  const out = investments.map((i) => {
    if (VALUE_TYPES.includes(i.type)) return i;
    const sym = symOf(i);
    const q = byId[i.id] || bySym[sym];
    const coinId = resolved[sym];
    if (!q && !(coinId && coinId !== i.coinId)) return i;
    changed = true;
    const next = { ...i };
    if (coinId) next.coinId = coinId;
    if (q) {
      next.price = roundPrice(q.price);
      next.priceUpdated = now;
      if (q.dayPct != null) { next.dayPct = Number(q.dayPct.toFixed(2)); next.dayPctAt = now; }
      if (q.ccy) next.qccy = q.ccy;
    }
    return next;
  });
  return changed ? out : investments;
}

/* Positionen ohne neuen Kurs */
export function failedIds(items, res) {
  const { bySym = {}, byId = {} } = res || {};
  return items.filter((i) => !byId[i.id] && !bySym[symOf(i)]).map((i) => i.id);
}

/* Ergebnis als kurzer Hinweis – Erfolg braucht keinen Text, die Werte blenden sich ein */
export function quoteMessage({ items, res, manual, lastUpdate, agoLabel }) {
  const fail = failedIds(items, res);
  const n = Object.keys(res.bySym).length + Object.keys(res.byId).length;
  const names = [...new Set(items.filter((i) => fail.includes(i.id)).map((i) => (i.symbol || i.name || "").toUpperCase()))].filter(Boolean);
  const busy = res.notes.some((x) => /Limit/i.test(x));
  const keyHint = res.notes.find((x) => /Key/i.test(x));
  const since = lastUpdate && agoLabel ? agoLabel(lastUpdate).replace(/\.$/, "") : "";
  let msg = "";
  if (!n && fail.length) {
    msg = busy
      ? "Kursdienste gerade ausgelastet – in einer Minute erneut ziehen."
      : `Kurse konnten gerade nicht aktualisiert werden${since ? ` – angezeigt wird der Stand von ${since}` : ""}.`;
  } else if (fail.length) {
    msg = `${names.length === 1 ? `${names[0]} wurde` : `${names.length} Kurse wurden`} nicht aktualisiert${names.length > 1 && names.length <= 3 ? ` (${names.join(", ")})` : ""} – dort gilt der letzte Stand.`;
  }
  if (manual && keyHint && !busy) msg = msg ? `${msg} ${keyHint}.` : `${keyHint}.`;
  /* automatisch: nur melden, wenn gar nichts ging (z. B. offline) */
  return msg && (manual || !n) ? msg : "";
}
