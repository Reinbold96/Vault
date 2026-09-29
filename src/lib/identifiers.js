/* ---------- Wertpapier-Kennungen: Ticker, ISIN, WKN ----------
   Gerechnet (Kurse, Historie, Logos) wird weiterhin mit dem Ticker. ISIN und
   WKN sind nur eine andere Art, die Position zu finden: Sie werden über zwei
   Dienste ohne API-Key in Ticker + Börse übersetzt und mitgespeichert.
   - onvista: WKN/ISIN → Name, ISIN, WKN, Heimat-Ticker
   - Twelve Data symbol_search: ISIN → Handelsplätze (Ticker, Börse, Währung) */

export const ID_MODES = [
  { id: "ticker", label: "Ticker", ph: "z. B. AAPL, IWDA, BTC" },
  { id: "isin", label: "ISIN", ph: "z. B. US8629453007" },
  { id: "wkn", label: "WKN", ph: "z. B. A41U5B" },
];

const clean = (s) => String(s || "").trim().toUpperCase().replace(/[\s-]/g, "");

/* ISIN-Prüfziffer (Luhn über die in Ziffern umgesetzten Zeichen) */
export function isinCheckDigit(body11) {
  const b = clean(body11);
  if (!/^[A-Z]{2}[A-Z0-9]{9}$/.test(b)) return null;
  const digits = b.split("").map((c) => (/[0-9]/.test(c) ? c : String(c.charCodeAt(0) - 55))).join("");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidIsin(s) {
  const v = clean(s);
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v)) return false;
  return isinCheckDigit(v.slice(0, 11)) === Number(v[11]);
}

/* WKN: 6 Zeichen, Ziffern und Buchstaben ohne I und O */
export function isValidWkn(s) {
  return /^[A-HJ-NP-Z0-9]{6}$/.test(clean(s));
}

/* Deutsche Wertpapiere: ISIN = DE000 + WKN + Prüfziffer (Fallback ohne onvista) */
export function wknToDeIsin(wkn) {
  const w = clean(wkn);
  if (!isValidWkn(w)) return "";
  const body = `DE000${w}`;
  const cd = isinCheckDigit(body);
  return cd == null ? "" : body + cd;
}

/* Was hat der Nutzer eingetippt? */
export function detectIdType(s) {
  const v = clean(s);
  if (isValidIsin(v)) return "isin";
  if (/\d/.test(v) && isValidWkn(v)) return "wkn";
  return "ticker";
}

/* Hinweis zur Eingabe, solange sie noch nicht passt (null = passt) */
export function idProblem(mode, s) {
  const v = clean(s);
  if (!v) return null;
  if (mode === "isin") {
    if (v.length < 12) return null;
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v)) return "Eine ISIN hat 12 Zeichen: 2 Buchstaben (Land), 9 Zeichen, 1 Prüfziffer.";
    return isValidIsin(v) ? null : "Prüfziffer passt nicht – bitte ISIN kontrollieren.";
  }
  if (mode === "wkn") {
    if (v.length < 6) return null;
    return isValidWkn(v) ? null : "Eine WKN hat 6 Zeichen (Ziffern und Buchstaben, ohne I und O).";
  }
  return null;
}

/* US-Handelsplätze – dort liefert Finnhub (kostenlos) die Kurse */
const US_MICS = ["XNAS", "XNGS", "XNCM", "XNMS", "XNYS", "ARCX", "XASE", "BATS", "IEXG"];
export const isUsMic = (mic) => !mic || US_MICS.includes(mic);

/* Namen aus Twelve Data kürzen: "Strive, Inc. Class A Common Stock" → "Strive, Inc." */
export function tidyName(n) {
  return String(n || "")
    .replace(/\s+(Class\s+[A-C]\s+)?(Common Stock|Ordinary Shares|Common Shares|Registered Shares)\b.*$/i, "")
    .replace(/\s+Class\s+[A-C]$/i, "")
    .trim();
}

/* Handelsplätze sortieren: US zuerst (freie Kurse), dann Anzeigewährung, dann Rest */
export function rankListings(list, homeSymbol, cur = "EUR") {
  const seen = new Set();
  const out = [];
  for (const d of list || []) {
    if (!d || !d.symbol) continue;
    const key = `${d.symbol}|${d.mic_code || d.exchange}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ symbol: String(d.symbol).toUpperCase(), exchange: d.exchange || "", mic: d.mic_code || "", ccy: d.currency || "", name: d.instrument_name || "", type: d.instrument_type || "" });
  }
  const score = (x) => {
    let s = 0;
    if (homeSymbol && x.symbol === homeSymbol) s -= 4;
    if (US_MICS.includes(x.mic)) s -= 3;
    if (/^(OTC|PINK)/i.test(x.exchange) || x.mic === "PSGM") s += 3;
    if (x.ccy === cur) s -= 1;
    return s;
  };
  const sorted = out.map((x, i) => ({ x, i })).sort((a, b) => score(a.x) - score(b.x) || a.i - b.i).map((o) => o.x);
  /* Gleicher Ticker an mehreren US-Börsen liefert denselben Kurs – nur einmal anbieten */
  const usSeen = new Set();
  return sorted.filter((x) => {
    if (!US_MICS.includes(x.mic)) return true;
    if (usSeen.has(x.symbol)) return false;
    usSeen.add(x.symbol);
    return true;
  });
}

/* ISIN/WKN → { name, type, isin, wkn, listings[], pick } oder null.
   fetchImpl ist austauschbar (Tests). Wirft nie – Netzfehler ergeben null/Teilergebnis. */
export async function resolveSecurity(mode, value, { fetchImpl = fetch, cur = "EUR" } = {}) {
  const v = clean(value);
  if (mode === "isin" ? !isValidIsin(v) : !isValidWkn(v)) return null;
  const getJson = async (url) => {
    try { const r = await fetchImpl(url); return r.ok ? await r.json() : null; } catch { return null; }
  };

  /* 1) onvista: liefert zu WKN und ISIN beide Kennungen und den Heimat-Ticker */
  let ov = null;
  const q = await getJson(`https://api.onvista.de/api/v1/instruments/query?searchValue=${encodeURIComponent(v)}&limit=5`);
  if (q && Array.isArray(q.list)) {
    ov = q.list.find((x) => x && (x.isin === v || x.wkn === v) && ["STOCK", "FUND"].includes(x.entityType)) || null;
  }
  const isin = mode === "isin" ? v : (ov && ov.isin) || wknToDeIsin(v);
  const wkn = mode === "wkn" ? v : (ov && ov.wkn) || "";
  const home = ov && ov.homeSymbol ? String(ov.homeSymbol).toUpperCase() : "";

  /* 2) Twelve Data: alle Handelsplätze zur ISIN */
  let listings = [];
  if (isin) {
    const td = await getJson(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(isin)}&outputsize=20`);
    if (td && Array.isArray(td.data)) listings = rankListings(td.data, home, cur);
  }
  if (!ov && !listings.length) return null;

  /* Heimat-Ticker ohne Twelve-Data-Treffer trotzdem anbieten */
  if (home && !listings.some((l) => l.symbol === home)) listings.unshift({ symbol: home, exchange: "Heimatbörse", mic: "", ccy: "", name: "", type: "" });
  if (!listings.length && ov && ov.symbol) listings.push({ symbol: String(ov.symbol).toUpperCase(), exchange: "Deutschland", mic: "", ccy: "EUR", name: "", type: "" });

  const pick = listings[0] || null;
  const tdName = listings.find((l) => l.name);
  const isFund = (ov && ov.entityType === "FUND") || /ETF|Fund/i.test((tdName && tdName.type) || "");
  return {
    name: tidyName((tdName && tdName.name) || (ov && ov.name) || ""),
    type: isFund ? "etf" : "aktie",
    isin: isValidIsin(isin) ? isin : "",
    wkn: isValidWkn(wkn) ? wkn : "",
    listings: listings.slice(0, 6),
    pick,
  };
}
