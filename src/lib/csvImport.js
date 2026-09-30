/* ---------- CSV-Import von Broker-Exporten ----------
   Versteht die Transaktions-Exporte von Scalable Capital und Trade Republic
   ("Transaktionsexport") sowie allgemeine CSV-Dateien mit Spalten wie Datum, Typ,
   ISIN, Stück, Kurs, Betrag. Ablauf:
     readCsv   → Kopfzeile finden, Trennzeichen erkennen, Spalten zuordnen
     toTxns    → Zeilen in Käufe, Verkäufe und Ausschüttungen übersetzen
     planImport→ gegen den Bestand abgleichen (Dubletten, Sparplan-Schätzungen)
     applyImport→ in die Daten übernehmen
   Alles rein – die Datei verlässt das Gerät nicht. */
import { isValidIsin, isValidWkn } from "./identifiers.js";
import { gkeyOf, fifo } from "./finance.js";
import { KNOWN_ASSETS } from "./constants.jsx";
import { uid } from "./utils.js";
import { addCashFlow } from "./booking.js";

/* ---------- CSV lesen ---------- */
function splitRows(s, delim) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell.trim() === "") { q = true; cell = ""; }
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

export function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).slice(0, 25).join("\n");
  let best = ",", bestScore = -1;
  for (const c of [";", ",", "\t", "|"]) {
    const rows = splitRows(sample, c).filter((r) => r.length > 1);
    if (!rows.length) continue;
    const freq = {};
    for (const r of rows) freq[r.length] = (freq[r.length] || 0) + 1;
    const [cols, cnt] = Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const score = cnt * Math.min(Number(cols), 30);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best;
}

/* ---------- Spalten erkennen ---------- */
const norm = (s) => String(s || "").toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, "")
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]/g, "");

export const FIELDS = [
  { id: "date", label: "Datum", syn: ["date", "datum", "buchungstag", "buchungsdatum", "handelstag", "schlusstag", "ausfuehrungsdatum", "tradedate", "transactiondate", "valuta", "valutadatum", "datetime", "zeitpunkt", "timestamp", "time"] },
  { id: "type", label: "Typ", syn: ["type", "typ", "transaktionstyp", "transaktionsart", "buchungsart", "art", "vorgang", "transactiontype", "action", "side", "geschaeftsart", "ordertyp"] },
  { id: "category", label: "Kategorie", syn: ["category", "kategorie"] },
  { id: "status", label: "Status", syn: ["status"] },
  { id: "isin", label: "ISIN", syn: ["isin"] },
  { id: "wkn", label: "WKN", syn: ["wkn"] },
  { id: "symbol", label: "Ticker", syn: ["symbol", "ticker", "tickersymbol", "kuerzel"] },
  { id: "name", label: "Name", syn: ["name", "description", "beschreibung", "wertpapier", "wertpapiername", "titel", "bezeichnung", "instrument", "security", "produkt", "asset"] },
  { id: "qty", label: "Stück", syn: ["shares", "stueck", "anzahl", "menge", "quantity", "qty", "units", "stuecknominale", "nominale"] },
  { id: "price", label: "Kurs", syn: ["price", "kurs", "preis", "ausfuehrungskurs", "kaufkurs", "stueckpreis", "unitprice", "priceperunit", "shareprice"] },
  { id: "amount", label: "Betrag", syn: ["amount", "betrag", "wert", "total", "value", "summe", "nettobetrag", "gesamtbetrag", "endbetrag", "netamount", "net"] },
  { id: "fee", label: "Gebühr", syn: ["fee", "fees", "gebuehr", "gebuehren", "provision", "kosten", "commission", "fremdkosten", "transaktionskosten"] },
  { id: "tax", label: "Steuer", syn: ["tax", "taxes", "steuer", "steuern", "quellensteuer", "withholdingtax", "kest"] },
  { id: "ccy", label: "Währung", syn: ["currency", "waehrung", "buchungswaehrung", "ccy"] },
  { id: "assetClass", label: "Anlageklasse", syn: ["assettype", "assetclass", "anlageklasse", "wertpapiertyp", "wertpapierart", "instrumenttype"] },
];

export function mapColumns(header) {
  const h = header.map(norm);
  const map = {};
  const used = new Set();
  for (const f of FIELDS) {
    for (const s of f.syn) {
      const i = h.findIndex((x, k) => x === s && !used.has(k));
      if (i >= 0) { map[f.id] = i; used.add(i); break; }
    }
  }
  return map;
}

function findHeader(rows) {
  let best = { idx: 0, score: -1 };
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const m = mapColumns(rows[i]);
    const score = Object.keys(m).length;
    if (score > best.score) best = { idx: i, score };
  }
  return best;
}

export function detectFormat(header) {
  const h = header.map(norm).join("|");
  if (/date\|time\|status\|reference\|description\|assettype\|type\|isin\|shares\|price\|amount\|fee\|tax\|currency/.test(h)) return "Scalable Capital";
  if (h.includes("datetime") && h.includes("category") && h.includes("type") && (h.includes("shares") || h.includes("amount"))) return "Trade Republic";
  if (h.includes("buchungswaehrung") && h.includes("wertpapiername")) return "Portfolio Performance";
  return "CSV";
}

/* ---------- Zahlen und Daten ---------- */
export function detectDecimal(values) {
  let comma = 0, dot = 0;
  for (const raw of values) {
    const v = String(raw || "").replace(/[^\d.,]/g, "");
    const lc = v.lastIndexOf(","), ld = v.lastIndexOf(".");
    if (lc > -1 && ld > -1) { if (lc > ld) comma++; else dot++; continue; }
    if (lc > -1) comma += v.length - lc - 1 === 3 ? 0.3 : 1;
    if (ld > -1) dot += v.length - ld - 1 === 3 ? 0.3 : 1;
  }
  return comma > dot ? "," : ".";
}

export function parseNum(raw, dec = ".") {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /(^|[^\deE])-|-$/.test(s);
  let v = s.replace(/[^\d.,]/g, "");
  if (!v) return null;
  v = dec === "," ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  const x = Number(v);
  if (!isFinite(x)) return null;
  return neg ? -x : x;
}

export function parseDate(raw) {
  const v = String(raw || "").trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    const [dd, mm] = a > 12 ? [a, b] : [b, a]; /* US-Format, ausser der Tag ist eindeutig */
    return `${m[3]}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return "";
}

/* ---------- Buchungsart ---------- */
export function classify(...parts) {
  const t = parts.filter(Boolean).join(" ").toLowerCase();
  if (!t.trim()) return "";
  if (/cancel|storn|reject|abgelehnt|fehlgeschlagen|failed|rueckbuchung|rückbuchung/.test(t)) return "skip";
  if (/verkauf|\bsell\b|\bsale\b|\bsold\b|^s$/.test(t)) return "sell";
  if (/stock_dividend|spin_off|unbundling|split/.test(t)) return "other";
  if (/dividend|dividende|ausschuettung|ausschüttung|distribution|ertrag|coupon|kupon/.test(t)) return "div";
  if (/\bbuy\b|kauf|savings ?plan|savings_plan|sparplan|purchase|bought|^b$/.test(t)) return "buy";
  if (/interest|zins/.test(t)) return "interest";
  return "other";
}

/* Trade Republic führt Krypto mit Pseudo-ISIN (XF000BTC0017) */
const CRYPTO_ISIN = /^XF000([A-Z]{2,6})\d{3,4}$/;
const NAME_TO_CRYPTO = Object.fromEntries(Object.entries(KNOWN_ASSETS).filter(([, v]) => v.type === "krypto").map(([k, v]) => [v.name.toLowerCase(), k]));
const ETF_NAME = /\bETF\b|\bETC\b|\bETP\b|UCITS|iShares|Vanguard|Xtrackers|x-trackers|Amundi|SPDR|Lyxor|Invesco|WisdomTree|VanEck|Franklin|Fidelity|\bIndex\b.*Fund|Core MSCI|MSCI World/i;

export function readCsv(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(src);
  const all = splitRows(src, delimiter);
  const { idx } = findHeader(all);
  const header = all[idx] || [];
  const rows = all.slice(idx + 1).filter((r) => r.length >= Math.min(3, header.length));
  const map = mapColumns(header);
  /* TR & Co.: "symbol" enthält die ISIN */
  if (map.symbol != null && map.isin == null) {
    const vals = rows.slice(0, 50).map((r) => r[map.symbol]).filter(Boolean);
    if (vals.length && vals.filter((v) => isValidIsin(v) || CRYPTO_ISIN.test(v)).length >= vals.length * 0.6) { map.isin = map.symbol; delete map.symbol; }
  }
  return { delimiter, header, rows, map, format: detectFormat(header) };
}

/* Zeilen → Buchungen */
export function toTxns(rows, map) {
  const col = (r, f) => (map[f] != null ? r[map[f]] : "");
  const numCols = ["qty", "price", "amount", "fee", "tax"].filter((f) => map[f] != null);
  const dec = detectDecimal(rows.slice(0, 200).flatMap((r) => numCols.map((f) => r[map[f]])));
  const txns = [];
  const stats = { rows: rows.length, buy: 0, sell: 0, div: 0, interest: 0, skipped: 0, invalid: 0 };
  rows.forEach((r, line) => {
    const status = col(r, "status");
    if (status && /cancel|storn|reject|abgelehnt|pending|offen|fehl/i.test(status)) { stats.skipped++; return; }
    const date = parseDate(col(r, "date"));
    const qtyRaw = parseNum(col(r, "qty"), dec);
    const amount = parseNum(col(r, "amount"), dec);
    let kind = classify(col(r, "type"), map.type == null ? col(r, "category") : "");
    if (!kind) {
      /* ohne Typ-Spalte: Vorzeichen entscheiden */
      if (qtyRaw && qtyRaw < 0) kind = "sell";
      else if (qtyRaw && amount != null) kind = amount < 0 ? "buy" : "sell";
      else kind = "other";
    }
    if (kind === "interest") { stats.interest++; return; }
    if (kind === "skip" || kind === "other") { stats.skipped++; return; }
    const rawIsin = String(col(r, "isin") || "").trim().toUpperCase();
    const assetClass = col(r, "assetClass");
    const name = col(r, "name");
    const cm = rawIsin.match(CRYPTO_ISIN);
    let type = "aktie", isin = "", symbol = String(col(r, "symbol") || "").trim().toUpperCase();
    if (cm || /crypto|krypto/i.test(assetClass)) {
      type = "krypto";
      symbol = (cm && cm[1]) || symbol || NAME_TO_CRYPTO[String(name).toLowerCase()] || "";
    } else {
      isin = isValidIsin(rawIsin) ? rawIsin : "";
      type = /etf|fund|fonds|etp|etc/i.test(assetClass) || ETF_NAME.test(name) ? "etf" : "aktie";
    }
    const wkn = String(col(r, "wkn") || "").trim().toUpperCase();
    const qty = Math.abs(qtyRaw || 0);
    const price = parseNum(col(r, "price"), dec);
    const fee = Math.abs(parseNum(col(r, "fee"), dec) || 0);
    const tax = Math.abs(parseNum(col(r, "tax"), dec) || 0);
    const t = {
      line: line + 1, kind, date, type, isin, wkn: isValidWkn(wkn) ? wkn : "", symbol, name: name || symbol || isin,
      qty, price: price != null ? Math.abs(price) : null, amount, fee, tax, ccy: String(col(r, "ccy") || "").trim().toUpperCase(),
    };
    const ident = t.isin || t.symbol || t.wkn;
    if (!date || !ident || (kind !== "div" && !(qty > 0)) || (kind === "div" && !(Math.abs(amount || 0) > 0 || (qty > 0 && t.price > 0)))) { stats.invalid++; return; }
    stats[kind]++;
    txns.push(t);
  });
  txns.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "buy" ? -1 : 1));
  return { txns, stats, dec };
}

/* ---------- Abgleich mit dem Bestand ---------- */
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

/* resolved: ISIN → { symbol, name, type, mic, exchange, wkn } (Ticker-Suche im Dialog)
   fx: 1 Einheit Fremdwährung in Anzeigewährung */
export function planImport(txns, d, { cur = "EUR", fx = {}, resolved = {} } = {}) {
  const inv = (d.investments || []).filter((x) => x.type !== "cash" && x.type !== "immobilie");
  const byIsin = new Map(), bySym = new Map();
  for (const x of inv) {
    if (x.isin && !byIsin.has(x.isin)) byIsin.set(x.isin, x);
    const s = String(x.symbol || "").toUpperCase();
    if (s && !bySym.has(`${x.type}:${s}`)) bySym.set(`${x.type}:${s}`, x);
  }
  const lots = [], sells = [], divs = [], replaceIds = new Set();
  const positions = new Map();
  let dup = 0, converted = 0;
  const missingFx = new Set();
  const existingLots = d.investments || [];

  for (const t of txns) {
    /* Betrag in die Anzeigewährung */
    let rate = 1;
    if (t.ccy && t.ccy !== cur) {
      if (fx[t.ccy] > 0) { rate = fx[t.ccy]; converted++; } else missingFx.add(t.ccy);
    }
    const match = (t.isin && byIsin.get(t.isin)) || (t.symbol && bySym.get(`${t.type}:${t.symbol}`)) || null;
    let tpl;
    if (match) {
      tpl = {};
      for (const k of ["type", "name", "symbol", "logoUrl", "isin", "wkn", "idType", "mic", "exchange", "coinId", "region"]) if (match[k] != null && match[k] !== "") tpl[k] = match[k];
    } else {
      const r = (t.isin && resolved[t.isin]) || {};
      tpl = {
        type: r.type || t.type, name: r.name || t.name, symbol: (r.symbol || t.symbol || t.isin || t.wkn).toUpperCase(),
        ...(t.isin ? { isin: t.isin, idType: "isin" } : {}), ...(t.wkn || r.wkn ? { wkn: t.wkn || r.wkn } : {}),
        ...(r.mic ? { mic: r.mic, exchange: r.exchange || "" } : {}),
      };
      if (tpl.type === "krypto") { delete tpl.isin; delete tpl.idType; delete tpl.wkn; }
    }
    const gkey = gkeyOf(tpl);
    if (!positions.has(gkey)) positions.set(gkey, { gkey, name: tpl.name, symbol: tpl.symbol, isin: t.isin, isNew: !match, resolved: !!(match || resolved[t.isin]), buys: 0, sells: 0, divs: 0 });
    const pos = positions.get(gkey);
    const sameGroup = (x) => gkeyOf(x) === gkey;

    if (t.kind === "buy") {
      const cost = (t.price != null ? t.qty * t.price + t.fee : Math.abs(t.amount || 0)) * rate;
      if (!(cost > 0)) continue;
      const buyPrice = cost / t.qty;
      if (existingLots.some((x) => sameGroup(x) && x.buyDate === t.date && near(Number(x.qty) || 0, t.qty, 1e-4) && !x.plan)) { dup++; continue; }
      /* Sparplan-Schätzung der App durch die echte Ausführung ersetzen */
      const est = existingLots.find((x) => sameGroup(x) && x.plan && !replaceIds.has(x.id) && x.buyDate && dayDiff(x.buyDate, t.date) <= 4);
      if (est) replaceIds.add(est.id);
      const priceNow = match ? Number(match.price) || 0 : 0;
      lots.push({ ...tpl, id: uid(), qty: t.qty, buyPrice, price: priceNow > 0 ? priceNow : buyPrice, buyDate: t.date, inChart: true, imp: true });
      pos.buys++;
    } else if (t.kind === "sell") {
      const proceeds = (t.price != null ? t.qty * t.price - t.fee : Math.abs(t.amount || 0)) * rate;
      if (!(proceeds >= 0)) continue;
      if ((d.sells || []).some((s) => s.gkey === gkey && s.date === t.date && near(Number(s.qty) || 0, t.qty, 1e-4))) { dup++; continue; }
      sells.push({ id: uid(), gkey, qty: t.qty, price: proceeds / t.qty, date: t.date });
      pos.sells++;
    } else if (t.kind === "div") {
      const amt = (Math.abs(t.amount || 0) || t.qty * (t.price || 0)) * rate;
      if ((d.divs || []).some((x) => x.gkey === gkey && x.date === t.date && near(Number(x.amt) || 0, amt, 0.005))) { dup++; continue; }
      divs.push({ id: uid(), gkey, amt: Math.round(amt * 100) / 100, date: t.date, ...(t.tax > 0 ? { tax: Math.round(t.tax * rate * 100) / 100 } : {}) });
      pos.divs++;
    }
  }

  /* Verkäufe ohne passende Käufe (z. B. Export beginnt mitten in der Historie) */
  const oversold = [];
  const keys = new Set([...sells.map((s) => s.gkey)]);
  for (const k of keys) {
    const allLots = [...existingLots.filter((x) => gkeyOf(x) === k && !replaceIds.has(x.id)), ...lots.filter((x) => gkeyOf(x) === k)];
    const allSells = [...(d.sells || []).filter((s) => s.gkey === k), ...sells.filter((s) => s.gkey === k)];
    const bought = allLots.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const f = fifo(allLots, allSells);
    if (f.soldQty > bought + 1e-6) oversold.push(positions.get(k)?.name || k);
  }

  return {
    lots, sells, divs, replaceIds: [...replaceIds],
    positions: [...positions.values()],
    dup, converted, missingFx: [...missingFx], oversold,
    count: lots.length + sells.length + divs.length,
  };
}

export function applyImport(d, plan, { toCash = false, cur = "EUR" } = {}) {
  const drop = new Set(plan.replaceIds || []);
  let investments = [...(d.investments || []).filter((x) => !drop.has(x.id)), ...plan.lots];
  if (toCash) {
    for (const s of plan.sells) investments = addCashFlow(investments, { cur, flow: { id: s.id, d: s.date, amt: s.qty * s.price } });
    for (const x of plan.divs) investments = addCashFlow(investments, { cur, flow: { id: x.id, d: x.date, amt: x.amt } });
  }
  return { ...d, investments, sells: [...(d.sells || []), ...plan.sells], divs: [...(d.divs || []), ...plan.divs] };
}
