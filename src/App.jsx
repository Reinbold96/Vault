import React, { useState, useEffect, useMemo, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, Sector, CartesianGrid } from "recharts";
import {
  Shield, Home, Car, Repeat, ShoppingCart, MoreHorizontal,
  Wallet, Baby, HeartHandshake, Coins, Landmark,
  LayoutGrid, Receipt, TrendingUp, Settings, Download, Upload,
  Heart, Stethoscope, Users, Banknote,
  Sofa, Sparkles, Fuel, ShoppingBag, Plane, Gamepad2, Utensils, Shirt, GraduationCap,
  Sun, Moon, Monitor, Gem, Eye, EyeOff, Fingerprint, Lock, PiggyBank, ChevronDown, Check, Info,
  Search, Percent, ArrowDownLeft, ArrowUpRight, Tag, Pencil, Trash2,
  ArrowDownWideNarrow, Layers,
} from "lucide-react";

/* ---------- Airbnb Design Tokens (aus DESIGN-airbnb.md) ---------- */
const C = {
  canvas: "var(--c-canvas)",
  soft: "var(--c-soft)",
  strong: "var(--c-strong)",
  ink: "var(--c-ink)",
  body: "var(--c-body)",
  muted: "var(--c-muted)",
  mutedSoft: "var(--c-mutedSoft)",
  hairline: "var(--c-hairline)",
  hairlineSoft: "var(--c-hairlineSoft)",
  borderStrong: "var(--c-borderStrong)",
  rausch: "var(--c-rausch)",
  rauschActive: "var(--c-rauschActive)",
  rauschDisabled: "var(--c-rauschDisabled)",
  luxe: "var(--c-luxe)",
  plus: "var(--c-plus)",
  error: "var(--c-error)",
  positive: "var(--c-positive)",
};

const FONT = "'Airbnb Cereal VF', Circular, Inter, -apple-system, system-ui, Roboto, 'Helvetica Neue', sans-serif";
const SHADOW = "rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px 0, rgba(0,0,0,0.1) 0 4px 8px 0";

const EXPENSE_CATS = [
  { id: "versicherung", label: "Versicherung", color: C.luxe },
  { id: "wohnen", label: "Wohnen", color: C.plus },
  { id: "mobilitaet", label: "Mobilität", color: C.rausch },
  { id: "abos", label: "Abos & Verträge", color: C.muted },
  { id: "leben", label: "Lebenshaltung", color: C.mutedSoft },
  { id: "spende", label: "Spende", color: "#8a5a2b" },
  { id: "gesundheit", label: "Gesundheit", color: "#4a7d6d" },
  { id: "familie", label: "Kinder & Familie", color: "#d68f6f" },
  { id: "sonstiges", label: "Sonstiges", color: C.borderStrong },
];

const INCOME_TYPES = [
  { id: "gehalt", label: "Gehalt" },
  { id: "kindergeld", label: "Kindergeld" },
  { id: "elterngeld", label: "Elterngeld" },
  { id: "sonstiges", label: "Sonstiges" },
];

const INVEST_TYPES = [
  { id: "aktie", label: "Aktie" },
  { id: "etf", label: "ETF" },
  { id: "krypto", label: "Krypto" },
  { id: "rohstoff", label: "Rohstoff" },
  { id: "immobilie", label: "Immobilie" },
  { id: "cash", label: "Cash" },
];

/* Rohstoffe: Edelmetalle keyless via gold-api (USD/Unze); Öl via Twelve Data */
const COMMODITIES = [
  { id: "gold", label: "Gold", unit: "Unzen", src: "metal", sym: "XAU" },
  { id: "silber", label: "Silber", unit: "Unzen", src: "metal", sym: "XAG" },
  { id: "platin", label: "Platin", unit: "Unzen", src: "metal", sym: "XPT" },
  { id: "palladium", label: "Palladium", unit: "Unzen", src: "metal", sym: "XPD" },
  { id: "wti", label: "Öl (WTI)", unit: "Barrel", src: "td", sym: "WTI/USD" },
  { id: "brent", label: "Öl (Brent)", unit: "Barrel", src: "td", sym: "BRENT/USD" },
];

/* Typen mit festem Wert statt Stückzahl × Kurs */
const VALUE_TYPES = ["immobilie", "cash"];

const CAT_ICONS = {
  versicherung: Shield,
  wohnen: Home,
  mobilitaet: Car,
  abos: Repeat,
  leben: ShoppingCart,
  spende: Heart,
  gesundheit: Stethoscope,
  familie: Users,
  sonstiges: MoreHorizontal,
};

const INCOME_ICONS = {
  gehalt: Wallet,
  kindergeld: Baby,
  elterngeld: HeartHandshake,
  sonstiges: Coins,
};

/* ---------- Variable Kostenkategorien ---------- */
const VARIABLE_CATS = [
  { id: "v_lebensmittel", label: "Lebensmittel", color: C.plus },
  { id: "v_haushalt", label: "Haushalt", color: C.luxe },
  { id: "v_drogerie", label: "Drogerie & Pflege", color: "#4a7d6d" },
  { id: "v_mobilitaet", label: "Mobilität", color: C.rausch },
  { id: "v_anschaffung", label: "Anschaffungen", color: "#8a5a2b" },
  { id: "v_urlaub", label: "Urlaub & Reisen", color: "#d68f6f" },
  { id: "v_restaurant", label: "Restaurant & Ausgehen", color: "#c17d3a" },
  { id: "v_freizeit", label: "Freizeit & Hobby", color: C.mutedSoft },
  { id: "v_kleidung", label: "Kleidung", color: "#5b8fb0" },
  { id: "v_gesundheit", label: "Gesundheit", color: "#3f7d99" },
  { id: "v_bildung", label: "Bildung", color: "#7a6ff0" },
  { id: "v_sonstiges", label: "Sonstiges", color: C.borderStrong },
];
const VAR_CAT_ICONS = {
  v_lebensmittel: ShoppingCart, v_haushalt: Sofa, v_drogerie: Sparkles,
  v_mobilitaet: Fuel, v_anschaffung: ShoppingBag, v_urlaub: Plane,
  v_restaurant: Utensils, v_freizeit: Gamepad2, v_kleidung: Shirt,
  v_gesundheit: Stethoscope, v_bildung: GraduationCap, v_sonstiges: MoreHorizontal,
};
/* Sparrate (nur im Budget-Modus): zählt NICHT zu den Gesamtkosten */
const SAVE_CAT = { id: "sparen", label: "Sparrate", color: "#2f9e6e" };
const ALL_CATS = [...EXPENSE_CATS, ...VARIABLE_CATS, SAVE_CAT];
const ALL_CAT_ICONS = { ...CAT_ICONS, ...VAR_CAT_ICONS, sparen: PiggyBank };

/* Farbpalette für selbst angelegte Kategorien */
const CAT_COLORS = ["#8a5a2b", "#4a7d6d", "#d68f6f", "#5b8fb0", "#7a6ff0", "#c17d3a", "#3f7d99", "#9e6b8f", "#6b8f3f"];
/* Kategorien einer Art: eingebaute plus eigene, mit möglichen Umbenennungen */
function catsOf(kind, data) {
  const base = kind === "variabel" ? VARIABLE_CATS : EXPENSE_CATS;
  const custom = (data.cats || []).filter((c) => (c.kind || "fix") === kind);
  const names = data.catNames || {};
  return [...base, ...custom].map((c) => ({ ...c, label: names[c.id] || c.label, custom: !base.includes(c) }));
}

/* Bekannte Ticker: sofortige Namens-/Typ-Erkennung ohne Netz */
const KNOWN_ASSETS = {
  AAPL: { name: "Apple", type: "aktie" }, MSFT: { name: "Microsoft", type: "aktie" },
  GOOGL: { name: "Alphabet", type: "aktie" }, GOOG: { name: "Alphabet", type: "aktie" },
  AMZN: { name: "Amazon", type: "aktie" }, TSLA: { name: "Tesla", type: "aktie" },
  NVDA: { name: "NVIDIA", type: "aktie" }, META: { name: "Meta Platforms", type: "aktie" },
  NFLX: { name: "Netflix", type: "aktie" }, AMD: { name: "AMD", type: "aktie" },
  SAP: { name: "SAP", type: "aktie" }, SIE: { name: "Siemens", type: "aktie" },
  ALV: { name: "Allianz", type: "aktie" }, BMW: { name: "BMW", type: "aktie" },
  MBG: { name: "Mercedes-Benz Group", type: "aktie" }, VOW3: { name: "Volkswagen", type: "aktie" },
  ADS: { name: "Adidas", type: "aktie" }, DTE: { name: "Deutsche Telekom", type: "aktie" },
  NESN: { name: "Nestlé", type: "aktie" }, NOVN: { name: "Novartis", type: "aktie" },
  ROG: { name: "Roche", type: "aktie" }, UBSG: { name: "UBS", type: "aktie" },
  IWDA: { name: "iShares Core MSCI World", type: "etf" },
  EUNL: { name: "iShares Core MSCI World", type: "etf" },
  VWCE: { name: "Vanguard FTSE All-World", type: "etf" },
  VUSA: { name: "Vanguard S&P 500", type: "etf" },
  SPY: { name: "SPDR S&P 500", type: "etf" }, QQQ: { name: "Invesco QQQ (Nasdaq 100)", type: "etf" },
  BTC: { name: "Bitcoin", type: "krypto" }, ETH: { name: "Ethereum", type: "krypto" },
  SOL: { name: "Solana", type: "krypto" }, XRP: { name: "XRP", type: "krypto" },
  ADA: { name: "Cardano", type: "krypto" }, DOGE: { name: "Dogecoin", type: "krypto" },
};

/* CoinGecko-IDs für gängige Kryptos (spart einen Such-Request) */
const CRYPTO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
  ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot", LTC: "litecoin",
  LINK: "chainlink", AVAX: "avalanche-2", MATIC: "matic-network",
  BNB: "binancecoin", TRX: "tron", XLM: "stellar",
};

/* Ticker → Domain für die Logo-Fallback-Kette */
const TICKER_DOMAINS = {
  AAPL: "apple.com", MSFT: "microsoft.com", GOOGL: "google.com", GOOG: "google.com",
  AMZN: "amazon.com", TSLA: "tesla.com", NVDA: "nvidia.com", META: "meta.com",
  NFLX: "netflix.com", AMD: "amd.com", INTC: "intel.com", IBM: "ibm.com",
  ORCL: "oracle.com", ADBE: "adobe.com", CRM: "salesforce.com", PYPL: "paypal.com",
  V: "visa.com", MA: "mastercard.com", DIS: "disney.com", KO: "coca-cola.com",
  MCD: "mcdonalds.com", UBER: "uber.com", ABNB: "airbnb.com", SHOP: "shopify.com",
  SAP: "sap.com", SIE: "siemens.com", ALV: "allianz.de", BMW: "bmw.com",
  MBG: "mercedes-benz.com", VOW3: "volkswagen.de", ADS: "adidas.de",
  DTE: "telekom.com", BAS: "basf.com", AIR: "airbus.com",
  NESN: "nestle.com", NOVN: "novartis.com", ROG: "roche.com",
  UBSG: "ubs.com", ABBN: "abb.com",
};

const uid = () => Math.random().toString(36).slice(2, 10);

/* Echte Hover-Geraete (Maus/Trackpad). Auf Touch feuern Browser Fake-Mouse-Events,
   die sonst mit dem Tap-Handler kollidieren -> Auswahl wechselt erst beim 2. Tippen. */
const CAN_HOVER = (() => {
  try { return window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch { return false; }
})();

/* "vor 3 Std." – Alter eines Zeitstempels in Worten */
const agoLabel = (ts) => {
  if (!ts) return "";
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 2) return "gerade";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? "gestern" : `vor ${d} Tagen`;
};

/* ---------- Währung (EUR / USD / CHF) ---------- */
const CURRENCIES = ["EUR", "USD", "CHF"];
let CUR = "EUR"; // wird beim Rendern aus den Einstellungen gesetzt
const curSym = () => (CUR === "EUR" ? "€" : CUR === "USD" ? "$" : "CHF");
const eur = (v) =>
  new Intl.NumberFormat(CUR === "CHF" ? "de-CH" : "de-DE", {
    style: "currency",
    currency: CUR,
    maximumFractionDigits: Math.abs(v) < 10 && v !== 0 ? 2 : 0,
  }).format(v || 0);
const eurFull = (v) =>
  new Intl.NumberFormat(CUR === "CHF" ? "de-CH" : "de-DE", { style: "currency", currency: CUR }).format(v || 0);
/* Betrag in einer beliebigen Währung (für Cash-Konten in Fremdwährung) */
const money = (v, ccy) =>
  new Intl.NumberFormat(ccy === "CHF" ? "de-CH" : "de-DE", { style: "currency", currency: ccy || CUR }).format(v || 0);
/* Stückzahlen kompakt: bis 8 Dezimalstellen, ohne unnötige Nullen */
const fmtQty = (v) => {
  const n = Number(v) || 0;
  const s = Math.abs(n) >= 1 ? n.toFixed(Math.abs(n % 1) < 1e-9 ? 0 : 4) : n.toFixed(8);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(".", ",");
};
const fmtDay = (iso) => {
  if (!iso) return "–";
  const [y, m, d] = String(iso).split("-");
  return d ? `${d}.${m}.${y}` : String(iso);
};

/* USD → Zielwährung, mit Fallback-Quelle (frankfurter.app ist unzuverlässig geworden) */
async function fetchUsdRate(target) {
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
async function fetchFx(from, to) {
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

/* Zensur-Maske für Vermögenswerte */
const MASK = "*****";

/* ---------- WebAuthn App-Lock (Biometrie, OS-Fallback PIN) ---------- */
const b64e = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (s) => {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const bioAvailable = () => typeof window !== "undefined" && !!(window.PublicKeyCredential && navigator.credentials);

/* Einmal entsperrt bleibt die App für diese Sitzung offen – ein Neuladen
   (z. B. Pull-to-Refresh) sperrt sie dadurch nicht erneut. Beim echten
   Schliessen der App verwirft der Browser den Session-Speicher. */
const UNLOCK_KEY = "vault_unlocked";
const sessionUnlocked = () => { try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; } };
const markUnlocked = () => { try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* Privatmodus */ } };
const clearUnlocked = () => { try { sessionStorage.removeItem(UNLOCK_KEY); } catch { /* Privatmodus */ } };
async function bioRegister() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Vault", id: location.hostname },
      user: { id: userId, name: "vault", displayName: "Vault" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
      attestation: "none",
    },
  });
  return cred ? b64e(cred.rawId) : null;
}
async function bioVerify(credId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const pk = { challenge, timeout: 60000, userVerification: "required", rpId: location.hostname };
  if (credId) pk.allowCredentials = [{ type: "public-key", id: b64d(credId), transports: ["internal"] }];
  const res = await navigator.credentials.get({ publicKey: pk });
  return !!res;
}

/* ---------- Kurshistorie: Quellen, Cache, Hilfsfunktionen ---------- */
/* Indizes sind bei Twelve Data kostenpflichtig – wir nutzen liquide ETF-Stellvertreter. */
const BENCHMARKS = [
  { id: "sp500", label: "S&P 500", sym: "SPY", color: "#4a96eb" },
  { id: "nasdaq", label: "Nasdaq 100", sym: "QQQ", color: "#b598ff" },
  { id: "world", label: "All World", sym: "URTH", color: "#f0a83a" },
  { id: "dax", label: "DAX", sym: "EWG", color: "#45c98a" },
];
/* Typen, für die es kostenlose Kurshistorie gibt */
const HIST_TYPES = ["aktie", "etf", "krypto"];
const HIST_KEY = "vault_hist_v1";
const CRYPTO_MAX_DAYS = 365; /* CoinGecko-Gratislimit */

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const todayIso = () => isoDay(Date.now());
const addDays = (iso, n) => isoDay(new Date(iso).getTime() + n * 86400000);
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function eachDay(startIso, endIso) {
  const out = [];
  for (let t = new Date(startIso).getTime(), e = new Date(endIso).getTime(); t <= e; t += 86400000) out.push(isoDay(t));
  return out;
}
function loadHist() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || "{}"); } catch { return {}; } }
function saveHist(h) { try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch { /* Speicher voll */ } }

/* Aktien/ETFs: Twelve Data (Tageswerte, Originalwährung) */
async function fetchStockHistory(sym, key, startIso) {
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
async function fetchCryptoHistory(coinId, cur, days) {
  const d = Math.min(Math.max(days, 2), CRYPTO_MAX_DAYS);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=${cur.toLowerCase()}&days=${d}&interval=daily`;
  const j = await fetch(url).then((r) => r.json());
  if (!j || !Array.isArray(j.prices)) throw new Error("NODATA");
  const series = {};
  for (const [ts, p] of j.prices) series[isoDay(ts)] = Number(p);
  return { ccy: cur, series };
}

/* Historische Wechselkurse (ein Request für den ganzen Zeitraum) */
async function fetchFxSeries(from, to, startIso) {
  if (from === to) return null;
  const j = await fetch(`https://api.frankfurter.dev/v1/${startIso}..?base=${from}&symbols=${to}`).then((r) => r.json());
  if (!j || !j.rates) throw new Error("NOFX");
  const series = {};
  for (const [d, o] of Object.entries(j.rates)) series[d] = o[to];
  return series;
}

/* Serie auf einen Tagesraster legen und Lücken (Wochenenden) fortschreiben */
function fillForward(series, dates) {
  const out = {};
  let last = null;
  for (const d of dates) {
    if (series[d] != null) last = series[d];
    if (last != null) out[d] = last;
  }
  return out;
}

/* ---------- Kredite: Restlaufzeit, Zinsen, automatische Tilgung ---------- */
/* Tilgungsplan bis zur vollständigen Rückzahlung (max. 100 Jahre) */
function payoffPlan(balance, rate, interestPct) {
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
function monthsUntil(iso) {
  if (!iso) return null;
  const end = new Date(iso);
  if (isNaN(end)) return null;
  const now = new Date();
  const m = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + (end.getDate() >= now.getDate() ? 0 : -1);
  return Math.max(0, m);
}
const monthsLabel = (m) => {
  if (!isFinite(m)) return "läuft nie ab";
  if (m <= 0) return "abbezahlt";
  const y = Math.floor(m / 12), r = m % 12;
  return `${y ? `${y} J. ` : ""}${r ? `${r} Mon.` : y ? "" : "0 Mon."}`.trim();
};

/* Vollständiger Tilgungsplan. Nach Ende der Zinsbindung wird mit dem
   angenommenen Anschlusszins weitergerechnet (Refinanzierung). */
function amortSchedule(credit) {
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
function applyDueCredits(d) {
  let changed = false;
  const credits = (d.credits || []).map((c) => {
    if (!c.paymentDay || !(Number(c.rate) > 0) || !(Number(c.balance) > 0)) return c;
    const now = new Date();
    const curIdx = now.getFullYear() * 12 + now.getMonth() - (now.getDate() < c.paymentDay ? 1 : 0);
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
function gkeyOf(i) {
  if (i.type === "cash") return `cash:${i.id}`;
  if (i.type === "immobilie") return `immobilie:${(i.name || i.id).toUpperCase()}`;
  if (i.type === "rohstoff") return `rohstoff:${(i.commodity || i.symbol || "").toUpperCase()}`;
  return `${i.type}:${(i.symbol || i.name || "").toUpperCase()}`;
}

/* FIFO: Verkäufe gegen die ältesten Käufe rechnen */
function fifo(lots, sells) {
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
function fifoAt(lots, sells, d) {
  return fifo(
    lots.filter((l) => (l.buyDate || "") && l.buyDate <= d),
    sells.filter((s) => (s.date || "") <= d),
  );
}

const cashAmount = (i) => Number(i.price) || 0;
const cashValue = (i, fx) => cashAmount(i) * (fx[i.ccy || CUR] || 1);
/* Cash-Stand an einem Stichtag: heutiger Betrag minus alle späteren Zuflüsse */
function cashAtDate(i, d) {
  const flows = Array.isArray(i.flows) ? i.flows : [];
  return cashAmount(i) - flows.filter((f) => (f.d || "") > d).reduce((a, f) => a + (Number(f.amt) || 0), 0);
}

/* Jahre zwischen zwei ISO-Tagen (Bruchteile erlaubt) */
const yearsBetween = (a, b) => (new Date(b) - new Date(a)) / (365.2425 * 86400000);

/* Wert einer Immobilie an einem Stichtag.
   Modus "rate": ab Kaufdatum mit der eingegebenen Rate p. a. verzinst.
   Modus "value": glatte Entwicklung vom Kaufpreis zum heute eingetragenen Wert
   (implizite Jahresrate) - so entsteht auch ohne Rate ein plausibler Verlauf. */
function propValueAt(i, d) {
  const base = Number(i.buyPrice) || Number(i.price) || 0;
  const start = i.buyDate || "";
  if ((i.valMode || "value") === "rate") {
    const r = (Number(i.growth) || 0) / 100;
    if (!start) return base;
    const y = Math.max(0, yearsBetween(start, d));
    return base * Math.pow(1 + r, y);
  }
  const now = Number(i.price) || base;
  if (!start || base <= 0 || now <= 0) return now;
  const yTot = yearsBetween(start, todayIso());
  if (yTot <= 0) return now;
  const y = Math.min(Math.max(0, yearsBetween(start, d)), yTot);
  return base * Math.pow(now / base, y / yTot);
}

/* Alle Positionen zu Gruppen zusammenfassen */
function buildGroups(investments, sells, fx) {
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

const monthly = (item) =>
  item.interval === "jaehrlich" ? (Number(item.amount) || 0) / 12 : Number(item.amount) || 0;

const EMPTY = { incomes: [], expenses: [], credits: [], investments: [], sells: [] };
const DATA_KEY = "finanz_state_v1";
const SETTINGS_KEY = "finanz_settings_v1";

const DEMO = {
  incomes: [
    { id: uid(), name: "Gehalt", type: "gehalt", amount: 4800 },
    { id: uid(), name: "Kindergeld", type: "kindergeld", amount: 255 },
    { id: uid(), name: "Elterngeld Partnerin", type: "elterngeld", amount: 1100 },
  ],
  expenses: [
    { id: uid(), name: "Miete", category: "wohnen", amount: 1250, interval: "monatlich" },
    { id: uid(), name: "Haftpflicht", category: "versicherung", amount: 89, interval: "jaehrlich" },
    { id: uid(), name: "KFZ-Versicherung", category: "versicherung", amount: 620, interval: "jaehrlich" },
    { id: uid(), name: "BU-Versicherung", category: "versicherung", amount: 78, interval: "monatlich" },
    { id: uid(), name: "Strom & Gas", category: "wohnen", amount: 180, interval: "monatlich" },
    { id: uid(), name: "Tanken Pendeln", category: "mobilitaet", amount: 320, interval: "monatlich" },
    { id: uid(), name: "Streaming & Handy", category: "abos", amount: 55, interval: "monatlich" },
    { id: uid(), name: "Lebenshaltung", category: "leben", amount: 300, interval: "monatlich" },
    { id: uid(), name: "Wocheneinkauf", category: "v_lebensmittel", amount: 480, interval: "monatlich", kind: "variabel" },
    { id: uid(), name: "Drogerie", category: "v_drogerie", amount: 60, interval: "monatlich", kind: "variabel" },
    { id: uid(), name: "Restaurant & Ausgehen", category: "v_restaurant", amount: 140, interval: "monatlich", kind: "variabel" },
    { id: uid(), name: "Sommerurlaub", category: "v_urlaub", amount: 2400, interval: "jaehrlich", kind: "variabel" },
  ],
  credits: [
    { id: uid(), name: "Autokredit", rate: 285, balance: 9400, interest: 4.9 },
  ],
  investments: [
    { id: uid(), name: "iShares Core MSCI World", symbol: "IWDA", type: "etf", qty: 42, buyPrice: 78.5, price: 92.1 },
    { id: uid(), name: "Bitcoin", symbol: "BTC", type: "krypto", qty: 0.11, buyPrice: 38000, price: 58000 },
    { id: uid(), name: "Apple", symbol: "AAPL", type: "aktie", qty: 10, buyPrice: 155, price: 190 },
  ],
};

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

/* ---------- Kleine UI-Bausteine ---------- */
const Card = ({ children, style }) => (
  <div className="fc-card" style={style}>{children}</div>
);

const SectionTitle = ({ children, right }) => (
  <div className="fc-sectiontitle">
    <span>{children}</span>
    {right}
  </div>
);

const Empty = ({ text, action }) => (
  <Card style={{ textAlign: "center", padding: "28px 16px" }}>
    <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.43, marginBottom: action ? 14 : 0 }}>{text}</div>
    {action}
  </Card>
);

const Btn = ({ children, onClick, kind = "primary", small, disabled, style }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`fc-btn ${kind} ${small ? "small" : ""}`}
    style={style}
  >
    {children}
  </button>
);

const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="fc-search">
    <span className="ic"><Search size={16} strokeWidth={2} /></span>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    {value && <button className="clr" onClick={() => onChange("")} aria-label="Suche leeren">×</button>}
  </div>
);

/* Betragsfeld: Komma-Eingabe, Tausenderpunkte beim Verlassen des Feldes */
function NumInput({ value, onChange, placeholder = "0", autoFocus }) {
  const fmt = (v) => {
    const n = Number(v);
    if (v === "" || v == null || isNaN(n)) return "";
    return n.toLocaleString(CUR === "CHF" ? "de-CH" : "de-DE", { maximumFractionDigits: 8 });
  };
  const [txt, setTxt] = useState(() => fmt(value));
  const [live, setLive] = useState(false);
  /* Wert von aussen übernehmen, solange nicht getippt wird */
  useEffect(() => { if (!live) setTxt(fmt(value)); }, [value, live]);
  const parse = (s) => {
    const clean = String(s).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    return clean === "" || clean === "-" ? "" : clean;
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      value={txt}
      placeholder={placeholder}
      onFocus={() => { setLive(true); setTxt(value === "" || value == null ? "" : String(value).replace(".", ",")); }}
      onChange={(e) => { setTxt(e.target.value); onChange(parse(e.target.value)); }}
      onBlur={() => { setLive(false); setTxt(fmt(parse(txt))); }}
    />
  );
}

const Field = ({ label, children }) => (
  <label className="fc-field">
    <span>{label}</span>
    {children}
  </label>
);

const YearTag = () => <span className="fc-tag">Jährlich</span>;

/* Untertitel aus mehreren kurzen Teilen – mit dezentem Trenner statt Textpunkt */
const Sub = ({ parts }) => (
  <>
    {parts.filter(Boolean).map((p, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="sep">·</span>}
        {p}
      </React.Fragment>
    ))}
  </>
);

const Lead = ({ icon: Ic }) => (
  <span className="fc-lead"><Ic size={18} strokeWidth={1.75} /></span>
);

/* ---------- Asset-Logo mit Fallback-Kette ---------- */
function logoCandidates(inv) {
  const sym = (inv.symbol || "").trim().toUpperCase();
  const list = [];
  if (inv.logoUrl) list.push(inv.logoUrl);
  if (!sym) return list;
  if (inv.type === "krypto") {
    list.push(`https://assets.parqet.com/logos/crypto/${encodeURIComponent(sym)}?format=png`);
    list.push(`https://assets.coincap.io/assets/icons/${sym.toLowerCase()}@2x.png`);
  } else {
    list.push(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(sym)}?format=png`);
    const domain = TICKER_DOMAINS[sym];
    if (domain) {
      list.push(`https://logo.clearbit.com/${domain}`);
      list.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
    }
  }
  return list;
}

function AssetLogo({ inv }) {
  const candidates = useMemo(() => logoCandidates(inv), [inv.symbol, inv.type, inv.logoUrl]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [inv.symbol, inv.type, inv.logoUrl]);
  const sym = (inv.symbol || "").trim();
  if (!candidates.length || idx >= candidates.length) {
    return <span className="fc-lead fc-monogram">{(sym || inv.name || "?").slice(0, 2).toUpperCase()}</span>;
  }
  return <img className="fc-logo" src={candidates[idx]} alt="" loading="lazy" onError={() => setIdx((i) => i + 1)} />;
}

/* ---------- Modal (Bottom Sheet) ---------- */
function Sheet({ title, onClose, children }) {
  return (
    <div className="fc-overlay" onClick={onClose}>
      <div className="fc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fc-sheet-head">
          <span>{title}</span>
          <button className="fc-x" onClick={onClose} aria-label="Schliessen">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Formulare ---------- */
function IncomeForm({ initial, onSave }) {
  const [f, setF] = useState(initial || { name: "", type: "gehalt", amount: "" });
  return (
    <div className="fc-form">
      <Field label="Bezeichnung">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Gehalt" />
      </Field>
      <div className="fc-row2">
        <Field label="Art">
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {INCOME_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label={`Betrag / Monat (${curSym()})`}>
          <NumInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} placeholder="0" />
        </Field>
      </div>
      <Btn disabled={!f.name || !f.amount} onClick={() => onSave({ ...f, amount: Number(f.amount) })}>Speichern</Btn>
    </div>
  );
}

function ExpenseForm({ initial, kind, onSave, catList, onAddCat }) {
  const effKind = (initial && initial.kind) || kind || "fix";
  const isSave = effKind === "sparen";
  const cats = isSave ? [SAVE_CAT] : catList || (effKind === "variabel" ? VARIABLE_CATS : EXPENSE_CATS);
  const [f, setF] = useState(initial || { name: isSave ? "Sparrate" : "", category: cats[0].id, amount: "", interval: "monatlich", kind: effKind });
  const [newCat, setNewCat] = useState("");
  const isFix = !isSave && effKind !== "variabel";
  return (
    <div className="fc-form">
      <Field label="Bezeichnung">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={isSave ? "z. B. Sparrate, ETF-Sparplan" : effKind === "variabel" ? "z. B. Wocheneinkauf" : "z. B. Haftpflicht"} />
      </Field>
      {!isSave && (
        <Field label="Kategorie">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            <option value="__new">＋ Neue Kategorie …</option>
          </select>
        </Field>
      )}
      {f.category === "__new" && (
        <Field label="Name der neuen Kategorie">
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="z. B. Haustier" autoFocus />
            <Btn
              small
              disabled={!newCat.trim()}
              onClick={() => { const id = onAddCat(newCat.trim(), effKind); setF({ ...f, category: id }); setNewCat(""); }}
              style={{ flexShrink: 0 }}
            >Anlegen</Btn>
          </div>
        </Field>
      )}
      <div className="fc-row2">
        <Field label={`Betrag (${curSym()})`}>
          <NumInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} placeholder="0" />
        </Field>
        <Field label="Intervall">
          <select value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value })}>
            <option value="monatlich">monatlich</option>
            <option value="jaehrlich">jährlich</option>
          </select>
        </Field>
      </div>
      {isFix && (
        <>
          <div className="fc-row2">
            <Field label="Vertrag bis">
              <input type="date" value={f.until || ""} onChange={(e) => setF({ ...f, until: e.target.value })} />
            </Field>
            <Field label="Kündigungsfrist (Mon.)">
              <input type="number" inputMode="numeric" value={f.notice ?? ""} onChange={(e) => setF({ ...f, notice: e.target.value })} placeholder="z. B. 3" />
            </Field>
          </div>
          <div style={{ fontSize: 13, color: C.muted, margin: "-6px 0 14px", lineHeight: 1.4 }}>
            Optional: Mit Vertragsende und Frist erinnert dich die App, sobald die Kündigung fällig wird.
          </div>
        </>
      )}
      <Btn
        disabled={!f.name || !f.amount || f.category === "__new"}
        onClick={() => onSave({ ...f, kind: effKind, amount: Number(f.amount), notice: f.notice === "" || f.notice == null ? "" : Number(f.notice) })}
      >Speichern</Btn>
    </div>
  );
}

function CreditForm({ initial, onSave }) {
  const [f, setF] = useState(initial || { name: "", rate: "", balance: "", interest: "", paymentDay: "", endDate: "" });
  const handleSave = () => {
    const paymentDay = Math.min(31, Math.max(0, Math.round(Number(f.paymentDay) || 0)));
    /* Restschuld gilt ab heute: Buchungen zählen erst ab der nächsten fälligen Abbuchung */
    const now = new Date();
    const idx = now.getFullYear() * 12 + now.getMonth();
    const lastAppliedIdx = paymentDay ? (now.getDate() >= paymentDay ? idx : idx - 1) : undefined;
    onSave({
      ...f,
      rate: Number(f.rate),
      balance: Number(f.balance) || 0,
      interest: Number(f.interest) || 0,
      endDate: f.endDate || "",
      fixedUntil: f.fixedUntil || "",
      followInterest: f.followInterest === "" || f.followInterest == null ? "" : Number(f.followInterest),
      paymentDay,
      lastAppliedIdx,
    });
  };
  return (
    <div className="fc-form">
      <Field label="Bezeichnung">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Immobilienkredit" />
      </Field>
      <div className="fc-row2">
        <Field label={`Monatsrate (${curSym()})`}>
          <NumInput value={f.rate} onChange={(v) => setF({ ...f, rate: v })} placeholder="0" />
        </Field>
        <Field label={`Restschuld (${curSym()})`}>
          <NumInput value={f.balance} onChange={(v) => setF({ ...f, balance: v })} placeholder="0" />
        </Field>
      </div>
      <div className="fc-row2">
        <Field label="Zinssatz (% p. a.)">
          <NumInput value={f.interest} onChange={(v) => setF({ ...f, interest: v })} placeholder="z. B. 3,2" />
        </Field>
        <Field label="Abbuchungstag">
          <input type="number" inputMode="numeric" value={f.paymentDay || ""} onChange={(e) => setF({ ...f, paymentDay: e.target.value })} placeholder="1–31" />
        </Field>
      </div>
      <Field label="Tilgungsschluss">
        <input type="date" value={f.endDate || ""} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
      </Field>
      <div className="fc-row2">
        <Field label="Zinsbindung bis">
          <input type="date" value={f.fixedUntil || ""} onChange={(e) => setF({ ...f, fixedUntil: e.target.value })} />
        </Field>
        <Field label="Zins danach (%)">
          <NumInput value={f.followInterest ?? ""} onChange={(v) => setF({ ...f, followInterest: v })} placeholder="z. B. 4" />
        </Field>
      </div>
      <div style={{ margin: "-6px 0 14px", fontSize: 13, lineHeight: 1.35, color: C.muted }}>
        Zinssatz, Abbuchungstag und Tilgungsschluss sind optional. Mit Abbuchungstag (1–31) tilgt die App automatisch jeden Monat
        (Rate minus Zinsanteil), mit Tilgungsschluss kommt die Restlaufzeit aus deinem Vertrag statt aus der Hochrechnung.
      </div>
      <Btn disabled={!f.name || !f.rate} onClick={handleSave}>Speichern</Btn>
    </div>
  );
}

function InvestForm({ initial, onSave, finnhubKey }) {
  const [f, setF] = useState(initial || { name: "", symbol: "", type: "etf", qty: "", buyPrice: "", price: "", logoUrl: "", buyDate: "", inChart: true });
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");

  async function lookup() {
    const sym = (f.symbol || "").trim().toUpperCase();
    if (!sym || f.name) return;
    const known = KNOWN_ASSETS[sym];
    if (known) {
      setF((p) => ({ ...p, name: known.name, type: known.type }));
      return;
    }
    setLooking(true);
    setLookupMsg("");
    let found = null;
    /* 1) CoinGecko-Suche (deckt Krypto ab, kein Key nötig) */
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`);
      const j = await r.json();
      const coin = (j.coins || []).find((x) => (x.symbol || "").toUpperCase() === sym);
      if (coin) found = { name: coin.name, type: "krypto" };
    } catch { /* weiter mit Finnhub */ }
    /* 2) Finnhub-Suche (Aktien/ETFs, Key nötig) */
    if (!found && finnhubKey) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(sym)}&token=${finnhubKey}`);
        const j = await r.json();
        const hit = (j.result || []).find((x) => (x.symbol || "").toUpperCase() === sym) || (j.result || [])[0];
        if (hit && hit.description) {
          const pretty = hit.description
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
          found = { name: pretty, type: hit.type === "ETP" ? "etf" : "aktie" };
        }
      } catch { /* Fallback unten */ }
    }
    if (found) {
      setF((p) => ({
        ...p,
        name: p.name || found.name,
        type: INVEST_TYPES.some((t) => t.id === found.type) ? found.type : p.type,
      }));
    } else {
      setLookupMsg(finnhubKey
        ? "Ticker nicht erkannt – Name bitte manuell eintragen."
        : "Ticker nicht erkannt. Tipp: Mit Finnhub-Key (Einstellungen) werden auch Aktien/ETFs erkannt.");
    }
    setLooking(false);
  }

  const sym = (f.symbol || "").trim().toUpperCase();
  const isValueType = VALUE_TYPES.includes(f.type);

  return (
    <div className="fc-form">
      <Field label="Typ">
        <select value={f.type} onChange={(e) => { const t = e.target.value; setF((p) => ({ ...p, type: t, ...(t === "rohstoff" && !p.commodity ? { commodity: "gold", name: "Gold", unit: "Unzen", symbol: "gold" } : {}) })); }}>
          {INVEST_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>

      {f.type === "rohstoff" ? (
        <>
          <Field label="Rohstoff">
            <select value={f.commodity || "gold"} onChange={(e) => { const c = COMMODITIES.find((x) => x.id === e.target.value); setF({ ...f, commodity: c.id, name: c.label, unit: c.unit, symbol: c.id }); }}>
              {COMMODITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <div className="fc-row2">
            <Field label={`Menge (${(COMMODITIES.find((x) => x.id === (f.commodity || "gold")) || {}).unit})`}>
              <NumInput value={f.qty} onChange={(v) => setF({ ...f, qty: v })} placeholder="0" />
            </Field>
            <Field label={`Kaufkurs (${curSym()})`}>
              <NumInput value={f.buyPrice} onChange={(v) => setF({ ...f, buyPrice: v })} placeholder="0" />
            </Field>
          </div>
          <div className="fc-row2">
            <Field label="Kaufdatum">
              <input type="date" value={f.buyDate || ""} onChange={(e) => setF({ ...f, buyDate: e.target.value })} />
            </Field>
            <Field label={`Aktueller Kurs (${curSym()})`}>
              <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
            </Field>
          </div>
          <div style={{ fontSize: 13, color: C.muted, margin: "-2px 0 12px", lineHeight: 1.4 }}>
            Edelmetalle werden automatisch aktualisiert (in Unzen). Öl braucht einen Twelve-Data-Key in den Einstellungen.
          </div>
          <Btn
            disabled={!f.qty}
            onClick={() => { const c = COMMODITIES.find((x) => x.id === (f.commodity || "gold")); onSave({ ...f, commodity: c.id, name: f.name || c.label, unit: c.unit, symbol: c.id, inChart: false, qty: Number(f.qty), buyPrice: Number(f.buyPrice) || 0, price: Number(f.price) || Number(f.buyPrice) || 0 }); }}
          >Speichern</Btn>
        </>
      ) : isValueType ? (
        <>
          <Field label="Bezeichnung">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.type === "immobilie" ? "z. B. Eigenheim" : "z. B. Tagesgeld"} />
          </Field>
          {f.type === "cash" && (
            <Field label="Währung">
              <div style={{ display: "flex", gap: 8 }}>
                {CURRENCIES.map((c) => (
                  <Btn key={c} kind={(f.ccy || CUR) === c ? "primary" : "ghost"} onClick={() => setF({ ...f, ccy: c })} style={{ flex: 1 }}>{c}</Btn>
                ))}
              </div>
            </Field>
          )}
          {f.type === "immobilie" ? (
            <>
              <div className="fc-row2">
                <Field label={`Kaufpreis (${curSym()})`}>
                  <NumInput value={f.buyPrice} onChange={(v) => setF({ ...f, buyPrice: v })} placeholder="0" />
                </Field>
                <Field label="Kaufdatum">
                  <input type="date" value={f.buyDate || ""} onChange={(e) => setF({ ...f, buyDate: e.target.value })} />
                </Field>
              </div>
              <Field label="Heutiger Wert">
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn kind={(f.valMode || "value") === "value" ? "primary" : "ghost"} onClick={() => setF({ ...f, valMode: "value" })} style={{ flex: 1 }}>Betrag</Btn>
                  <Btn kind={f.valMode === "rate" ? "primary" : "ghost"} onClick={() => setF({ ...f, valMode: "rate" })} style={{ flex: 1 }}>Rate</Btn>
                </div>
              </Field>
              {f.valMode === "rate" ? (
                <Field label="Wertsteigerung (% pro Jahr)">
                  <NumInput value={f.growth} onChange={(v) => setF({ ...f, growth: v })} placeholder="2" />
                </Field>
              ) : (
                <Field label={`Aktueller Wert (${curSym()})`}>
                  <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
                </Field>
              )}
            </>
          ) : (
            <Field label={`Betrag (${f.ccy || CUR})`}>
              <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
            </Field>
          )}
          {f.type === "immobilie" && (
            <div style={{ fontSize: 13, color: C.muted, margin: "-2px 0 12px", lineHeight: 1.4 }}>
              {f.valMode === "rate"
                ? "Der Wert wächst ab dem Kaufdatum jährlich mit dieser Rate."
                : "Zwischen Kaufpreis und heutigem Wert wird gleichmässig interpoliert."}
              {!f.buyDate && " Für den Verlaufs-Chart ist ein Kaufdatum nötig."}
            </div>
          )}
          {f.type === "cash" && (f.ccy || CUR) !== CUR && (
            <div style={{ fontSize: 13, color: C.muted, margin: "-2px 0 12px", lineHeight: 1.4 }}>
              Der Betrag wird mit dem aktuellen Wechselkurs in {CUR} umgerechnet.
            </div>
          )}
          <button type="button" className="fc-check" onClick={() => setF({ ...f, inChart: f.inChart === false })}>
            <span className={`box ${f.inChart !== false ? "on" : ""}`}>{f.inChart !== false && <Check size={13} strokeWidth={3} />}</span>
            <span>Im Verlaufs-Chart anzeigen</span>
          </button>
          <Btn
            disabled={!f.name || (f.type === "immobilie" ? (f.valMode === "rate" ? !f.buyPrice : !f.price) : !f.price)}
            onClick={() => {
              const isProp = f.type === "immobilie";
              const valMode = isProp ? (f.valMode === "rate" ? "rate" : "value") : undefined;
              const base = Number(f.buyPrice) || Number(f.price) || 0;
              const growth = Number(f.growth) || 0;
              /* Bei "Rate" ergibt sich der heutige Wert aus Kaufpreis, Datum und Rate */
              const price = isProp
                ? (valMode === "rate"
                    ? propValueAt({ buyPrice: base, buyDate: f.buyDate, valMode: "rate", growth }, todayIso())
                    : Number(f.price) || base)
                : Number(f.price) || 0;
              onSave({
                ...f,
                symbol: "",
                qty: 1,
                ccy: f.type === "cash" ? (f.ccy || CUR) : undefined,
                valMode,
                growth: isProp ? growth : undefined,
                buyDate: isProp ? (f.buyDate || "") : f.buyDate,
                price: Number(price.toFixed(2)),
                buyPrice: f.type === "cash" ? Number(f.price) || 0 : base,
              });
            }}
          >Speichern</Btn>
        </>
      ) : (
        <>
          <Field label="Symbol / Ticker">
            <input
              value={f.symbol}
              onChange={(e) => setF({ ...f, symbol: e.target.value.toUpperCase(), name: "" })}
              onBlur={lookup}
              placeholder="z. B. AAPL, IWDA, BTC"
              autoFocus={!initial}
            />
          </Field>
          <Field label="Name">
            <input
              value={looking ? "" : f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder={looking ? "Wird ermittelt …" : "Wird automatisch ausgefüllt"}
              disabled={looking}
            />
          </Field>
          {lookupMsg && <div style={{ margin: "-6px 0 12px", fontSize: 13, color: C.error }}>{lookupMsg}</div>}
          <div className="fc-row2">
            <Field label="Anzahl">
              <NumInput value={f.qty} onChange={(v) => setF({ ...f, qty: v })} placeholder="0" />
            </Field>
            <Field label={`Kaufkurs (${curSym()})`}>
              <NumInput value={f.buyPrice} onChange={(v) => setF({ ...f, buyPrice: v })} placeholder="0" />
            </Field>
          </div>
          <div className="fc-row2">
            <Field label="Kaufdatum">
              <input type="date" value={f.buyDate || ""} onChange={(e) => setF({ ...f, buyDate: e.target.value })} />
            </Field>
            <Field label={`Aktueller Kurs (${curSym()})`}>
              <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
            </Field>
          </div>
          <Field label="Logo-URL (optional)">
            <input value={f.logoUrl || ""} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <button type="button" className="fc-check" onClick={() => setF({ ...f, inChart: f.inChart === false })}>
            <span className={`box ${f.inChart !== false ? "on" : ""}`}>{f.inChart !== false && <Check size={13} strokeWidth={3} />}</span>
            <span>Im Verlaufs-Chart anzeigen</span>
          </button>
          <Btn
            disabled={!sym || !f.qty || looking}
            onClick={() => onSave({ ...f, name: f.name || sym, symbol: sym, qty: Number(f.qty), buyPrice: Number(f.buyPrice) || 0, price: Number(f.price) || Number(f.buyPrice) || 0 })}
          >Speichern</Btn>
        </>
      )}
    </div>
  );
}

/* ---------- Kategorien verwalten ---------- */
function CatManager({ sections, counts, onRename, onRemove }) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState("");
  const start = (c) => { setEditId(c.id); setDraft(c.label); };
  const commit = () => {
    const name = draft.trim();
    if (editId && name) onRename(editId, name);
    setEditId(null);
  };
  return (
    <div>
      {sections.map((sec) => (
        <div key={sec.kind} style={{ marginBottom: 18 }}>
          <div className="fc-catsec">{sec.label}</div>
          <div className="fc-catcard">
            {sec.list.map((c) => {
              const used = counts[c.id] || 0;
              const editing = editId === c.id;
              return (
                <div className={`fc-catrow ${editing ? "editing" : ""}`} key={c.id}>
                  <span className="dot" style={{ background: c.color }} />
                  {editing ? (
                    <input
                      className="fc-catinput"
                      value={draft}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditId(null); }}
                    />
                  ) : (
                    <div className="txt">
                      <div className="nm">{c.label}</div>
                      <div className="sub">{used ? `${used} ${used === 1 ? "Eintrag" : "Einträge"}` : "nicht genutzt"}</div>
                    </div>
                  )}
                  <div className="acts">
                    {editing ? (
                      <button className="fc-catbtn ok" onMouseDown={(e) => e.preventDefault()} onClick={commit} aria-label="Namen speichern">
                        <Check size={15} strokeWidth={2.4} />
                      </button>
                    ) : (
                      <>
                        <button className="fc-catbtn" onClick={() => start(c)} aria-label={`${c.label} umbenennen`}>
                          <Pencil size={14} strokeWidth={2} />
                        </button>
                        {c.custom && (
                          <button className="fc-catbtn del" disabled={used > 0} onClick={() => onRemove(c.id)} aria-label={`${c.label} löschen`}>
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="fc-detail-note">
        Zum Umbenennen auf das Stift-Symbol tippen. Eigene Kategorien legst du beim Erfassen einer Ausgabe an – löschen geht nur, solange keine Einträge daran hängen.
      </div>
    </div>
  );
}

/* ---------- Sparziel ---------- */
function GoalForm({ initial, onSave }) {
  const [f, setF] = useState(initial || { name: "", target: "", saved: "", deadline: "" });
  return (
    <div className="fc-form">
      <Field label="Bezeichnung">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Notgroschen" autoFocus={!initial} />
      </Field>
      <div className="fc-row2">
        <Field label={`Zielbetrag (${curSym()})`}>
          <NumInput value={f.target} onChange={(v) => setF({ ...f, target: v })} />
        </Field>
        <Field label={`Schon gespart (${curSym()})`}>
          <NumInput value={f.saved} onChange={(v) => setF({ ...f, saved: v })} />
        </Field>
      </div>
      <Field label="Zieldatum">
        <input type="date" value={f.deadline || ""} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
      </Field>
      <Btn disabled={!f.name || !f.target} onClick={() => onSave({ ...f, target: Number(f.target) || 0, saved: Number(f.saved) || 0 })}>Speichern</Btn>
    </div>
  );
}

function AmountForm({ label, hint, cta, onSave, initialDate = true }) {
  const [f, setF] = useState({ amt: "", date: todayIso() });
  const amt = Number(f.amt) || 0;
  return (
    <div className="fc-form">
      {hint && <div className="fc-detail-note" style={{ marginBottom: 14 }}>{hint}</div>}
      <div className="fc-row2">
        <Field label={label}>
          <NumInput value={f.amt} onChange={(v) => setF({ ...f, amt: v })} autoFocus />
        </Field>
        {initialDate && (
          <Field label="Datum">
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        )}
      </div>
      <Btn disabled={!amt} onClick={() => onSave({ amt, date: f.date })}>{cta}</Btn>
    </div>
  );
}

/* ---------- Dividende / Zinsertrag ---------- */
function DivForm({ group, onSave }) {
  const [f, setF] = useState({ amt: "", date: todayIso(), toCash: true });
  const amt = Number(f.amt) || 0;
  return (
    <div className="fc-form">
      <div className="fc-detail-note" style={{ marginBottom: 14 }}>
        Bestand: <b>{fmtQty(group.qty)} {group.type === "rohstoff" ? (group.ref.unit || "Einheiten") : "Stück"}</b> – erfasse den erhaltenen Betrag nach Steuern.
      </div>
      <div className="fc-row2">
        <Field label={`Betrag (${curSym()})`}>
          <NumInput value={f.amt} onChange={(v) => setF({ ...f, amt: v })} autoFocus />
        </Field>
        <Field label="Datum">
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
      </div>
      <button type="button" className="fc-check" onClick={() => setF({ ...f, toCash: !f.toCash })}>
        <span className={`box ${f.toCash ? "on" : ""}`}>{f.toCash && <Check size={13} strokeWidth={3} />}</span>
        <span>Auf das Cash-Konto buchen</span>
      </button>
      <Btn disabled={!amt} onClick={() => onSave(f)}>Ausschüttung buchen</Btn>
    </div>
  );
}

/* ---------- Cash-Konto: Bewegungen ---------- */
function CashDetail({ inv, fxRates, onIn, onOut, onEdit, onDeleteFlow }) {
  const ccy = inv.ccy || CUR;
  const amt = cashAmount(inv);
  const flows = [...(inv.flows || [])].sort((a, b) => (b.d || "").localeCompare(a.d || ""));
  return (
    <div>
      <div className="fc-detail-kpis">
        <div><span className="l">Bestand</span><span className="v">{money(amt, ccy)}</span></div>
        {ccy !== CUR && <div><span className="l">In {CUR}</span><span className="v">{eur(amt * (fxRates[ccy] || 1))}</span></div>}
        <div><span className="l">Währung</span><span className="v">{ccy}</span></div>
        <div><span className="l">Buchungen</span><span className="v">{flows.length}</span></div>
      </div>

      {flows.length > 0 && (
        <>
          <div className="fc-detail-sec">Bewegungen</div>
          {flows.slice(0, 12).map((f) => (
            <div className="fc-detail-row" key={f.id}>
              <div className="m">
                <div className="t" style={{ color: (Number(f.amt) || 0) >= 0 ? C.positive : C.ink }}>
                  {(Number(f.amt) || 0) >= 0 ? "+" : "−"}{money(Math.abs(Number(f.amt) || 0), ccy)}
                </div>
                <div className="s"><Sub parts={[fmtDay(f.d), f.label || "Verkaufserlös"]} /></div>
              </div>
              <div className="r">
                <button className="fc-del" onClick={() => onDeleteFlow(f.id)} aria-label="Buchung löschen">–</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Btn onClick={onIn} style={{ gap: 6 }}><ArrowDownLeft size={16} strokeWidth={2} /> Einzahlen</Btn>
        <Btn kind="ghost" onClick={onOut} style={{ gap: 6 }}><ArrowUpRight size={16} strokeWidth={2} /> Auszahlen</Btn>
      </div>
      <div style={{ marginTop: 10 }}><Btn kind="ghost" onClick={onEdit}>Konto bearbeiten</Btn></div>
    </div>
  );
}

/* ---------- Sondertilgung buchen ---------- */
function ExtraPaymentForm({ credit, onSave, cashAvail = 0 }) {
  const [f, setF] = useState({ amt: "", date: todayIso(), fromCash: cashAvail > 0 });
  const amt = Number(f.amt) || 0;
  const bal = Number(credit.balance) || 0;
  const capped = Math.min(amt, bal);
  const before = payoffPlan(bal, credit.rate, credit.interest);
  const after = payoffPlan(bal - capped, credit.rate, credit.interest);
  const savedInterest = isFinite(before.interest) && isFinite(after.interest) ? before.interest - after.interest : null;
  const savedMonths = isFinite(before.months) && isFinite(after.months) ? before.months - after.months : null;

  return (
    <div className="fc-form">
      <div className="fc-detail-note" style={{ marginBottom: 14 }}>
        Restschuld heute: <b>{eurFull(bal)}</b>
        {credit.interest ? <> · {String(credit.interest).replace(".", ",")} % p. a.</> : null}
      </div>
      <div className="fc-row2">
        <Field label={`Betrag (${curSym()})`}>
          <NumInput value={f.amt} onChange={(v) => setF({ ...f, amt: v })} placeholder="0" autoFocus />
        </Field>
        <Field label="Datum">
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
      </div>
      <button type="button" className="fc-mini" onClick={() => setF({ ...f, amt: String(bal) })}>Restschuld komplett ablösen</button>
      {cashAvail > 0 && (
        <button type="button" className="fc-check" onClick={() => setF({ ...f, fromCash: !f.fromCash })}>
          <span className={`box ${f.fromCash ? "on" : ""}`}>{f.fromCash && <Check size={13} strokeWidth={3} />}</span>
          <span>Vom Cash-Konto abbuchen ({eur(cashAvail)} verfügbar)</span>
        </button>
      )}
      {f.fromCash && capped > cashAvail && (
        <div style={{ margin: "0 0 12px", fontSize: 13, color: C.error }}>Auf dem Cash-Konto liegen nur {eurFull(cashAvail)} – der Rest wird nicht abgebucht.</div>
      )}
      {amt > bal && <div style={{ margin: "0 0 12px", fontSize: 13, color: C.error }}>Mehr als die Restschuld ({eurFull(bal)}) ist nicht möglich – es werden {eurFull(bal)} gebucht.</div>}
      {capped > 0 && (
        <div className="fc-detail-note" style={{ marginBottom: 14 }}>
          Restschuld danach: <b>{eurFull(bal - capped)}</b>
          {savedMonths != null && savedMonths > 0 && <> · Laufzeit {savedMonths} Monate kürzer ({monthsLabel(after.months)} statt {monthsLabel(before.months)})</>}
          {savedInterest != null && savedInterest > 0 && <> · spart ca. <b style={{ color: C.positive }}>{eurFull(savedInterest)}</b> Zinsen</>}
        </div>
      )}
      <Btn disabled={!capped} onClick={() => onSave({ amt: capped, date: f.date || todayIso(), fromCash: f.fromCash && cashAvail > 0 })}>Sondertilgung buchen</Btn>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        Die Restschuld sinkt sofort – Nettovermögen und Dashboard rechnen automatisch neu.
      </div>
    </div>
  );
}

/* ---------- Tilgungsplan ---------- */
function AmortView({ credit }) {
  const plan = useMemo(() => amortSchedule(credit), [credit]);
  const fixIdx = plan.fixMonths != null && plan.fixMonths <= plan.rows.length ? plan.fixMonths : null;
  /* Zwei Linien: bis Zinsbindungsende durchgezogen, danach gestrichelt (Annahme) */
  const chart = useMemo(() => {
    const step = Math.max(1, Math.ceil(plan.rows.length / 300));
    return plan.rows
      .filter((_, i) => i % step === 0 || i === plan.rows.length - 1)
      .map((r) => ({
        ...r,
        bal1: fixIdx == null || r.m <= fixIdx ? r.bal : null,
        bal2: fixIdx != null && r.m >= fixIdx ? r.bal : null,
      }));
  }, [plan.rows, fixIdx]);
  const fixRow = fixIdx ? plan.rows[fixIdx - 1] : null;
  const follow = credit.followInterest === "" || credit.followInterest == null ? credit.interest : credit.followInterest;

  if (plan.stalled) {
    return (
      <div className="fc-detail-note">
        Mit einer Monatsrate von {eurFull(credit.rate)} und {String(credit.interest).replace(".", ",")} % Zinsen wächst die Restschuld –
        der Zinsanteil ist grösser als die Rate. Prüfe Rate oder Zinssatz.
      </div>
    );
  }

  return (
    <div>
      <div className="fc-detail-kpis">
        <div><span className="l">Laufzeit</span><span className="v">{monthsLabel(plan.months)}</span></div>
        <div><span className="l">Zinsen gesamt</span><span className="v">{eur(plan.totalInterest)}</span></div>
        {fixRow && (
          <>
            <div>
              <span className="l">Restschuld bei Bindungsende</span>
              <span className="v">{eur(fixRow.bal)}</span>
              <span className="l" style={{ marginTop: 1 }}>{fmtDay(credit.fixedUntil)}</span>
            </div>
            <div>
              <span className="l">Anschlusszins</span>
              <span className="v">{String(follow).replace(".", ",")} %</span>
              <span className="l" style={{ marginTop: 1 }}>Annahme</span>
            </div>
          </>
        )}
      </div>

      <div style={{ width: "100%", height: 200, marginTop: 10 }}>
        <ResponsiveContainer>
          <LineChart data={chart} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} minTickGap={28} />
            <YAxis width={58} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline}
              tickFormatter={(v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} Mio` : Math.round(v).toLocaleString(CUR === "CHF" ? "de-CH" : "de-DE"))} />
            <Tooltip
              formatter={(v, n) => [eurFull(v), n]}
              labelFormatter={(l) => `Jahr ${l}`}
              contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 12.5, boxShadow: SHADOW }}
              labelStyle={{ color: C.muted }}
              itemStyle={{ color: C.ink }}
            />
            <Line type="monotone" dataKey="bal1" name="Zinsbindung" stroke={C.rausch} strokeWidth={2.4} dot={false} connectNulls={false} />
            {fixRow && <Line type="monotone" dataKey="bal2" name="nach Refinanzierung" stroke={C.luxe} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="fc-detail-sec">Pro Jahr</div>
      <div className="fc-planhead">
        <span>Jahr</span><span>Zinsen</span><span>Tilgung</span><span>Restschuld</span>
      </div>
      <div className="fc-plantable">
        {plan.years.map((y) => (
          <div className="fc-planrow" key={y.year}>
            <span>{y.year}</span>
            <span>{eur(y.interest)}</span>
            <span>{eur(y.principal)}</span>
            <span>{eur(y.bal)}</span>
          </div>
        ))}
      </div>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        {fixRow
          ? `Bis ${fmtDay(credit.fixedUntil)} rechnet der Plan mit ${String(credit.interest).replace(".", ",")} %, danach mit ${String(follow).replace(".", ",")} % – der Anschlusszins ist eine Annahme, keine Zusage.`
          : "Ohne Zinsbindung rechnet der Plan durchgehend mit dem aktuellen Zinssatz. Trage die Zinsbindung ein, um die Restschuld bei Refinanzierung zu sehen."}
      </div>
    </div>
  );
}

/* ---------- Kredit-Detail: Kennzahlen und Sondertilgungen ---------- */
function CreditDetail({ credit, onExtra, onDeleteExtra, onEdit, onPlan }) {
  const bal = Number(credit.balance) || 0;
  const plan = payoffPlan(bal, credit.rate, credit.interest);
  const termMonths = monthsUntil(credit.endDate);
  const extras = [...(credit.extras || [])].sort((a, b) => (b.d || "").localeCompare(a.d || ""));
  const extraSum = extras.reduce((s, e) => s + (Number(e.amt) || 0), 0);

  return (
    <div>
      <div className="fc-detail-kpis">
        <div><span className="l">Restschuld</span><span className="v">{eur(bal)}</span></div>
        <div><span className="l">Monatsrate</span><span className="v">{eur(credit.rate)}</span></div>
        <div><span className="l">Zinssatz</span><span className="v">{credit.interest ? `${String(credit.interest).replace(".", ",")} %` : "–"}</span></div>
        <div>
          <span className="l">Restlaufzeit</span>
          <span className="v">{monthsLabel(termMonths != null ? termMonths : plan.months)}</span>
          <span className="l" style={{ marginTop: 1 }}>{credit.endDate ? `bis ${fmtDay(credit.endDate)}` : "rechnerisch"}</span>
        </div>
        {isFinite(plan.interest) && plan.interest > 0 && (
          <div><span className="l">Zinsen bis Ende</span><span className="v">{eur(plan.interest)}</span></div>
        )}
        {extraSum > 0 && (
          <div><span className="l">Sondertilgungen</span><span className="v" style={{ color: C.positive }}>{eur(extraSum)}</span></div>
        )}
      </div>

      {extras.length > 0 && (
        <>
          <div className="fc-detail-sec">Sondertilgungen</div>
          {extras.map((e) => (
            <div className="fc-detail-row" key={e.id}>
              <div className="m">
                <div className="t">{eurFull(e.amt)}</div>
                <div className="s">{fmtDay(e.d)}</div>
              </div>
              <div className="r">
                <button className="fc-del" onClick={() => onDeleteExtra(e.id)} aria-label="Sondertilgung löschen">–</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Btn disabled={bal <= 0} onClick={onExtra}>Sondertilgung</Btn>
        <Btn kind="ghost" onClick={onPlan} disabled={bal <= 0 || !(Number(credit.rate) > 0)}>Tilgungsplan</Btn>
      </div>
      <div style={{ marginTop: 10 }}><Btn kind="ghost" onClick={onEdit}>Kredit bearbeiten</Btn></div>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        {credit.paymentDay
          ? `Die Monatsrate wird am ${credit.paymentDay}. automatisch verbucht${credit.interest ? " – der Zinsanteil wird dabei abgezogen" : ""}.`
          : "Ohne Abbuchungstag bleibt die Restschuld unverändert – trage ihn beim Bearbeiten nach, dann tilgt die App automatisch."}
        {termMonths == null && " Trage einen Tilgungsschluss ein, dann kommt die Restlaufzeit aus deinem Vertrag statt aus der Hochrechnung."}
        {extras.length > 0 && " Beim Löschen einer Sondertilgung wird der Betrag der Restschuld wieder zugerechnet."}
      </div>
    </div>
  );
}

/* ---------- Verkaufen ---------- */
function SellForm({ group, onSave }) {
  const unit = group.type === "rohstoff" ? (group.ref.unit || "Einheiten") : "Stück";
  const [f, setF] = useState({ qty: "", price: group.price ? String(group.price) : "", date: todayIso() });
  const qty = Number(f.qty) || 0;
  const price = Number(f.price) || 0;
  const tooMuch = qty > group.qty + 1e-9;
  /* Vorschau: welcher Gewinn wird nach FIFO realisiert? */
  const preview = useMemo(() => {
    if (!qty || !price) return null;
    const f2 = fifo(group.lots, [...group.sells, { id: "_p", qty, price, date: f.date || todayIso() }]);
    const m = f2.matches.find((x) => x.id === "_p");
    return m ? m.realized : null;
  }, [qty, price, f.date, group]);

  return (
    <div className="fc-form">
      <div className="fc-detail-note" style={{ marginBottom: 14 }}>
        Verfügbar: <b>{fmtQty(group.qty)} {unit}</b> · Ø Kaufkurs {eurFull(group.avgBuy)}
      </div>
      <div className="fc-row2">
        <Field label={`Menge (${unit})`}>
          <NumInput value={f.qty} onChange={(v) => setF({ ...f, qty: v })} placeholder="0" autoFocus />
        </Field>
        <Field label={`Verkaufskurs (${curSym()})`}>
          <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
        </Field>
      </div>
      <Field label="Verkaufsdatum">
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      </Field>
      <button type="button" className="fc-mini" onClick={() => setF({ ...f, qty: String(group.qty) })}>Alles verkaufen</button>
      {tooMuch && <div style={{ margin: "0 0 12px", fontSize: 13, color: C.error }}>Mehr als der Bestand ({fmtQty(group.qty)} {unit}) lässt sich nicht verkaufen.</div>}
      {!tooMuch && qty > 0 && price > 0 && (
        <div className="fc-detail-note" style={{ marginBottom: 14 }}>
          Erlös <b>{eurFull(qty * price)}</b> wird deinem Cash-Konto in {CUR} zugebucht.
          {preview != null && <> Realisierter Gewinn nach FIFO: <b style={{ color: preview >= 0 ? C.positive : C.error }}>{preview >= 0 ? "+" : ""}{eurFull(preview)}</b>.</>}
        </div>
      )}
      <Btn disabled={!qty || !price || tooMuch} onClick={() => onSave({ qty, price, date: f.date || todayIso() })}>Verkauf buchen</Btn>
    </div>
  );
}

/* ---------- Asset-Detail: alle Käufe und Verkäufe einer Position ---------- */
function AssetDetail({ group, divs = [], onAddLot, onEditLot, onDeleteLot, onSell, onDeleteSell, onDiv, onDeleteDiv }) {
  const unit = group.type === "rohstoff" ? (group.ref.unit || "Einheiten") : "Stück";
  const lots = [...group.lots].sort((a, b) => (a.buyDate || "9999-12-31").localeCompare(b.buyDate || "9999-12-31"));
  const sells = [...group.sells].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const realizedById = {};
  for (const m of group.matches || []) realizedById[m.id] = m.realized;
  const myDivs = [...divs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const divSum = myDivs.reduce((s, x) => s + (Number(x.amt) || 0), 0);
  const cut = addDays(todayIso(), -365);
  const div12 = myDivs.filter((x) => (x.date || "") >= cut).reduce((s, x) => s + (Number(x.amt) || 0), 0);
  const pct = group.cost > 0 ? (group.unreal / group.cost) * 100 : 0;

  return (
    <div>
      <div className="fc-detail-kpis">
        <div><span className="l">Wert</span><span className="v">{eur(group.value)}</span></div>
        <div><span className="l">Bestand</span><span className="v">{fmtQty(group.qty)} {unit}</span></div>
        <div><span className="l">Ø Kaufkurs</span><span className="v">{eurFull(group.avgBuy)}</span></div>
        <div><span className="l">Aktueller Kurs</span><span className="v">{eurFull(group.price)}</span></div>
        <div>
          <span className="l">Nicht realisiert</span>
          <span className="v" style={{ color: group.unreal >= 0 ? C.positive : C.error }}>
            {group.unreal >= 0 ? "+" : ""}{eur(group.unreal)}{group.cost > 0 ? ` · ${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")} %` : ""}
          </span>
        </div>
        <div>
          <span className="l">Realisiert (FIFO)</span>
          <span className="v" style={{ color: group.realized > 0 ? C.positive : group.realized < 0 ? C.error : C.muted }}>
            {group.realized >= 0 ? "+" : ""}{eur(group.realized)}
          </span>
        </div>
        {divSum > 0 && (
          <div>
            <span className="l">Ausschüttungen</span>
            <span className="v" style={{ color: C.positive }}>+{eur(divSum)}</span>
            <span className="l" style={{ marginTop: 1 }}>{div12 > 0 ? `${eur(div12)} letzte 12 Mon.` : "gesamt"}</span>
          </div>
        )}
      </div>

      <div className="fc-detail-sec">Käufe</div>
      {lots.map((l) => (
        <div className="fc-detail-row" key={l.id}>
          <div className="m" onClick={() => onEditLot(l)}>
            <div className="t">{fmtQty(l.qty)} {unit} × {eurFull(l.buyPrice || 0)}</div>
            <div className="s"><Sub parts={[l.buyDate ? fmtDay(l.buyDate) : "ohne Kaufdatum", l.inChart === false ? "nicht im Chart" : null]} /></div>
          </div>
          <div className="r">
            <span className="a">{eur((Number(l.qty) || 0) * (Number(l.buyPrice) || 0))}</span>
            <button className="fc-del" onClick={() => onDeleteLot(l.id)} aria-label="Kauf löschen">–</button>
          </div>
        </div>
      ))}

      {sells.length > 0 && (
        <>
          <div className="fc-detail-sec">Verkäufe</div>
          {sells.map((s) => (
            <div className="fc-detail-row" key={s.id}>
              <div className="m">
                <div className="t">{fmtQty(s.qty)} {unit} × {eurFull(s.price || 0)}</div>
                <div className="s">
                  <Sub parts={[
                    fmtDay(s.date),
                    <>realisiert{" "}
                      <b style={{ color: (realizedById[s.id] || 0) >= 0 ? C.positive : C.error }}>
                        {(realizedById[s.id] || 0) >= 0 ? "+" : ""}{eurFull(realizedById[s.id] || 0)}
                      </b>
                    </>,
                  ]} />
                </div>
              </div>
              <div className="r">
                <span className="a">{eur((Number(s.qty) || 0) * (Number(s.price) || 0))}</span>
                <button className="fc-del" onClick={() => onDeleteSell(s.id)} aria-label="Verkauf löschen">–</button>
              </div>
            </div>
          ))}
        </>
      )}

      {myDivs.length > 0 && (
        <>
          <div className="fc-detail-sec">Ausschüttungen</div>
          {myDivs.slice(0, 10).map((x) => (
            <div className="fc-detail-row" key={x.id}>
              <div className="m">
                <div className="t" style={{ color: C.positive }}>+{eurFull(x.amt)}</div>
                <div className="s">{fmtDay(x.date)}</div>
              </div>
              <div className="r">
                <button className="fc-del" onClick={() => onDeleteDiv(x.id)} aria-label="Ausschüttung löschen">–</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Btn onClick={onAddLot}>Zukauf</Btn>
        <Btn kind="ghost" disabled={group.qty <= 0} onClick={onSell}>Verkaufen</Btn>
      </div>
      <div style={{ marginTop: 10 }}>
        <Btn kind="ghost" onClick={onDiv} style={{ gap: 6 }}><Percent size={15} strokeWidth={2} /> Dividende / Zinsen</Btn>
      </div>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        Verkäufe werden nach FIFO abgerechnet: die ältesten Käufe gehen zuerst. Erlöse und Ausschüttungen landen auf deinem Cash-Konto.
      </div>
    </div>
  );
}

/* ---------- Cashflow-Leiste ---------- */
function CashflowBar({ catTotals, creditRate, surplus, savings = 0, budgetFree = 0, budgetMode = false }) {
  const [open, setOpen] = useState(false);
  const segs = [
    ...catTotals.filter((c) => c.value > 0).map((c) => ({ label: c.label, value: c.value, color: c.color })),
    ...(creditRate > 0 ? [{ label: "Kredite", value: creditRate, color: C.ink }] : []),
    ...(budgetMode && savings > 0 ? [{ label: SAVE_CAT.label, value: savings, color: SAVE_CAT.color }] : []),
    ...(budgetMode
      ? (budgetFree > 0 ? [{ label: "Budget frei", value: budgetFree, color: C.positive }] : [])
      : (surplus > 0 ? [{ label: "Überschuss", value: surplus, color: C.positive }] : [])),
  ];
  const total = segs.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const sorted = [...segs].sort((a, b) => b.value - a.value);
  return (
    <div>
      <button className="fc-flowtoggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Details ausblenden" : "Details anzeigen"}>
        <div className="fc-flowbar">
          {segs.map((s, i) => (
            <div key={i} title={`${s.label}: ${eur(s.value)}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          ))}
        </div>
        <span className={`fc-flowchev ${open ? "open" : ""}`}><ChevronDown size={16} strokeWidth={2} /></span>
      </button>
      <div className="fc-flowlist" style={{ display: open ? "flex" : "none" }}>
        {sorted.map((s, i) => {
          const pct = (s.value / total) * 100;
          return (
            <div className="fc-flowrow" key={i}>
              <span className="dot" style={{ background: s.color }} />
              <span className="lbl">{s.label}</span>
              <span className="track"><span className="fill" style={{ width: `${Math.max(2, pct)}%`, background: s.color }} /></span>
              <span className="amt">{eur(s.value)}</span>
              <span className="pct">{pct < 1 ? "<1" : Math.round(pct)} %</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Prognose (Zinseszins) ---------- */
function ForecastView({ surplus, startValue }) {
  const [info, setInfo] = useState(false);
  const [ratePct, setRatePct] = useState("5");
  const [contrib, setContrib] = useState(String(Math.max(0, Math.round(surplus || 0))));
  const P = Math.max(0, startValue || 0);
  const C0 = Math.max(0, Number(contrib) || 0);
  const annual = Math.max(0, Number(ratePct) || 0) / 100;
  const r = Math.pow(1 + annual, 1 / 12) - 1;
  const value = (m) => (r > 0 ? P * Math.pow(1 + r, m) + C0 * ((Math.pow(1 + r, m) - 1) / r) : P + C0 * m);
  const months = [];
  for (let m = 1; m <= 24; m++) months.push(m);
  for (let m = 27; m <= 120; m += 3) months.push(m);
  for (let m = 132; m <= 480; m += 12) months.push(m);
  const series = months.map((m) => ({ m, value: Math.round(value(m)) }));
  const xTicks = [1, 3, 6, 12, 24, 60, 120, 240, 360, 480];
  const xFmt = (m) => (m < 12 ? `${m} M` : `${Math.round(m / 12)} J`);
  const compact = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + " Mio";
    if (a >= 1e3) return Math.round(v / 1e3) + "k";
    return String(Math.round(v));
  };
  const milestones = [12, 60, 120, 240, 480];
  const invested = (m) => P + C0 * m;
  return (
    <div>
      <div className="fc-row2" style={{ marginBottom: 6 }}>
        <Field label="Jährlicher Zins (%)">
          <input type="number" inputMode="decimal" value={ratePct} onChange={(e) => setRatePct(e.target.value)} placeholder="5" />
        </Field>
        <Field label={`Monatlich sparen (${curSym()})`}>
          <NumInput value={contrib} onChange={setContrib} />
        </Field>
      </div>
      <div className="fc-inforow">
        <button type="button" className="fc-info" onClick={() => setInfo((v) => !v)} aria-expanded={info} aria-label="Erklärung zur Prognose">
          <Info size={15} strokeWidth={2} />
        </button>
        <span className="fc-infolbl" onClick={() => setInfo((v) => !v)}>Wie wird gerechnet?</span>
      </div>
      {info && (
        <div style={{ fontSize: 13, color: C.muted, margin: "8px 0 12px", lineHeight: 1.45 }}>
          Startwert ist dein heutiges Nettovermögen ({eur(P)}), verzinst mit Zinseszins (monatlich).
          X-Achse logarithmisch – links Monate, rechts bis 40 Jahre.
        </div>
      )}
      <div style={{ width: "100%", height: 240, marginTop: info ? 0 : 8 }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 14, bottom: 2, left: 2 }}>
            <XAxis dataKey="m" type="number" scale="log" domain={[1, 480]} ticks={xTicks} tickFormatter={xFmt} tick={{ fontSize: 11, fill: C.muted }} stroke={C.hairline} />
            <YAxis tickFormatter={compact} width={46} tick={{ fontSize: 11, fill: C.muted }} stroke={C.hairline} />
            <Tooltip
              formatter={(v) => [eurFull(v), "Vermögen"]}
              labelFormatter={(m) => (m < 12 ? `${m} Monate` : `${(m / 12).toFixed(m % 12 ? 1 : 0).replace(".", ",")} Jahre`)}
              contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 13, boxShadow: SHADOW }}
              labelStyle={{ color: C.muted }}
              itemStyle={{ color: C.ink }}
            />
            <Line type="monotone" dataKey="value" stroke={C.rausch} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 14 }}>
        {milestones.map((m) => {
          const val = Math.round(value(m));
          const zins = Math.max(0, val - Math.round(invested(m)));
          return (
            <div className="fc-forecast-row" key={m}>
              <span style={{ color: C.muted }}>{m < 12 ? `in ${m} Monaten` : `in ${m / 12} Jahren`}</span>
              <span className="fv">{eur(val)} <span style={{ color: C.positive, fontWeight: 500, fontSize: 13 }}>+{eur(zins)} Zins</span></span>
            </div>
          );
        })}
      </div>
      {C0 <= 0 && P <= 0 && (
        <div style={{ fontSize: 13, color: C.muted, marginTop: 12, lineHeight: 1.4 }}>
          Erfasse Einnahmen und Kosten, damit ein monatlicher Überschuss entsteht – dann zeigt die Prognose, wie dein Vermögen wächst.
        </div>
      )}
    </div>
  );
}

/* ---------- Portfolio-Wertentwicklung ---------- */
const RANGES = [
  { id: "1M", label: "1M", days: 30 },
  { id: "6M", label: "6M", days: 182 },
  { id: "YTD", label: "YTD", days: 0, ytd: true },
  { id: "1J", label: "1J", days: 365 },
  { id: "MAX", label: "Max", days: 0 },
];

/* 1. Januar des laufenden Jahres als ISO-Tag (Start fuer YTD) */
const yearStartIso = () => `${new Date().getFullYear()}-01-01`;

/* Datenschlüssel einer Gruppe im Historien-Cache */
const histKeyOf = (g, cur) => g.type === "krypto"
  ? `cg:${g.ref.coinId || (g.ref.symbol || "").toUpperCase()}:${cur}`
  : `td:${(g.ref.symbol || "").toUpperCase()}`;

function PortfolioChart({ groups, cur, tdKey, fxRates, benchmarks, onToggleBenchmark, range: rangeProp, mode: modeProp, onRange, onMode, masked = false }) {
  /* Zeitraum und Darstellung liegen in den Settings, damit die Wahl einen App-Neustart ueberlebt */
  const range = RANGES.some((r) => r.id === rangeProp) ? rangeProp : "6M";
  const mode = modeProp === "perf" ? "perf" : "value";
  const setRange = onRange;
  const setMode = onMode;
  const [hover, setHover] = useState(null);
  const chartBox = useRef(null);
  const [state, setState] = useState({ loading: false, rows: [], notes: [], err: "" });

  /* Gruppen mit Kurshistorie, Kaufdatum und Chart-Häkchen */
  const eligible = useMemo(() => groups.filter((g) =>
    HIST_TYPES.includes(g.type) && g.inChart && (g.ref.symbol || g.ref.coinId) && g.lots.some((l) => l.buyDate && l.inChart !== false)
  ), [groups]);
  const cashGroups = useMemo(() => groups.filter((g) => g.type === "cash" && g.inChart), [groups]);
  /* Immobilien laufen ohne Kursquelle - sie brauchen nur ein Kaufdatum */
  const propGroups = useMemo(() => groups.filter((g) => g.type === "immobilie" && g.inChart && g.ref.buyDate), [groups]);

  const activeBms = BENCHMARKS.filter((b) => benchmarks.includes(b.id));
  const eligKey = eligible.map((g) => `${g.gkey}|${g.lots.map((l) => `${l.qty}@${l.buyDate}`).join("+")}|${g.sells.map((s) => `${s.qty}@${s.date}`).join("+")}`).join(",");
  const cashKey = cashGroups.map((g) => `${g.gkey}|${cashAmount(g.ref)}|${g.ref.ccy || cur}|${(g.ref.flows || []).length}`).join(",");
  const propKey = propGroups.map((g) => `${g.gkey}|${g.ref.buyDate}|${g.ref.valMode || "value"}|${g.ref.growth || 0}|${g.ref.price}|${g.ref.buyPrice}`).join(",");
  const bmKey = benchmarks.join(",");

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!eligible.length && !cashGroups.length && !propGroups.length) { setState({ loading: false, rows: [], notes: [], err: "" }); return; }
      setState((s) => ({ ...s, loading: true, err: "" }));
      const notes = [];
      const hist = loadHist();
      const today = todayIso();
      const buyDates = [
        ...eligible.flatMap((g) => g.lots.map((l) => l.buyDate).filter(Boolean)),
        ...propGroups.map((g) => g.ref.buyDate).filter(Boolean),
      ];
      const earliest = buyDates.length ? buyDates.sort()[0] : addDays(today, -180);
      const startAll = earliest < addDays(today, -3650) ? addDays(today, -3650) : earliest;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      /* --- benötigte Serien laden (Tages-Cache) --- */
      const need = [];
      for (const g of eligible) {
        if (g.type === "krypto") need.push({ key: histKeyOf(g, cur), kind: "crypto", g });
        else need.push({ key: histKeyOf(g, cur), kind: "stock", sym: (g.ref.symbol || "").toUpperCase() });
      }
      for (const b of activeBms) need.push({ key: `td:${b.sym}`, kind: "stock", sym: b.sym, bm: b });

      const uniq = [];
      const seen = new Set();
      for (const n of need) { if (!seen.has(n.key)) { seen.add(n.key); uniq.push(n); } }

      let planBlocked = [], limitHit = false;
      for (const n of uniq) {
        const c = hist[n.key];
        if (c && c.fetched === today && c.series) continue;
        try {
          if (n.kind === "crypto") {
            const coinId = n.g.ref.coinId || CRYPTO_IDS[(n.g.ref.symbol || "").toUpperCase()];
            if (!coinId) { notes.push(`${n.g.name}: keine Krypto-ID`); continue; }
            const days = Math.min(CRYPTO_MAX_DAYS, Math.max(2, daysBetween(startAll, today) + 1));
            const r = await fetchCryptoHistory(coinId, cur, days);
            hist[n.key] = { fetched: today, ccy: r.ccy, series: r.series };
            await sleep(400);
          } else {
            if (!tdKey) { notes.push("Für Kurshistorie von Aktien/ETFs den Twelve-Data-Key in den Einstellungen eintragen"); continue; }
            const r = await fetchStockHistory(n.sym, tdKey, startAll);
            hist[n.key] = { fetched: today, ccy: r.ccy, series: r.series };
            await sleep(900); /* 8 Anfragen/Min schonen */
          }
        } catch (e) {
          if (String(e.message) === "PLAN") planBlocked.push(n.sym || n.key);
          else if (String(e.message) === "LIMIT") { limitHit = true; break; }
          else notes.push(`${n.sym || (n.g && n.g.name)}: keine Historie`);
        }
      }
      saveHist(hist);
      if (planBlocked.length) notes.push(`Nicht im Gratis-Tarif: ${[...new Set(planBlocked)].join(", ")}`);
      if (limitHit) notes.push("Datenlimit erreicht – in 1 Minute erneut öffnen");
      if (cancelled) return;

      /* --- Wechselkurse für Fremdwährungen (Kurse und Cash-Konten) --- */
      const needFx = new Set();
      for (const n of uniq) { const h = hist[n.key]; if (h && h.ccy && h.ccy !== cur) needFx.add(h.ccy); }
      for (const g of cashGroups) { const c = g.ref.ccy || cur; if (c !== cur) needFx.add(c); }
      const fx = {};
      for (const ccy of needFx) {
        const fxKey = `fx:${ccy}:${cur}`;
        if (hist[fxKey] && hist[fxKey].fetched === today) { fx[ccy] = hist[fxKey].series; continue; }
        try {
          const s = await fetchFxSeries(ccy, cur, startAll);
          if (s) { fx[ccy] = s; hist[fxKey] = { fetched: today, series: s }; }
        } catch { notes.push(`Wechselkurs ${ccy}→${cur} nicht verfügbar`); }
      }
      saveHist(hist);
      if (cancelled) return;

      /* --- Zeitachse & Serien zusammensetzen --- */
      const dates = eachDay(startAll, today);
      const filled = {};
      for (const n of uniq) {
        const h = hist[n.key];
        if (h && h.series) filled[n.key] = fillForward(h.series, dates);
      }
      const fxFilled = {};
      for (const [ccy, s] of Object.entries(fx)) fxFilled[ccy] = fillForward(s, dates);

      /* Zeitgewichtete Rendite über die Wertpapiere: Zu- und Verkäufe verzerren die
         Kurve nicht, dadurch ist der Vergleich mit den Indizes fair. Cash zählt nur im Wert. */
      const chartLots = new Map();
      for (const g of eligible) chartLots.set(g.gkey, g.lots.filter((l) => l.inChart !== false && l.buyDate));
      const rows = [];
      let twr = 100, prev = null;
      for (const d of dates) {
        let assets = 0, invested = 0, any = false;
        const px = {};
        for (const g of eligible) {
          const pos = fifoAt(chartLots.get(g.gkey) || [], g.sells, d);
          if (pos.openQty <= 1e-10) continue;
          const key = histKeyOf(g, cur);
          const ser = filled[key];
          const raw = ser && ser[d];
          if (raw == null) continue;
          const h = hist[key];
          const rate = h && h.ccy && h.ccy !== cur ? (fxFilled[h.ccy] && fxFilled[h.ccy][d]) : 1;
          if (rate == null) continue;
          const p = raw * rate;
          px[g.gkey] = { p, qty: pos.openQty };
          assets += pos.openQty * p;
          invested += pos.openCost;
          any = true;
        }
        /* Cash: heutiger Stand minus alle späteren Zuflüsse, in Anzeigewährung */
        let cash = 0;
        for (const g of cashGroups) {
          const ccy = g.ref.ccy || cur;
          const r = ccy === cur ? 1 : ((fxFilled[ccy] && fxFilled[ccy][d]) ?? (fxRates && fxRates[ccy]) ?? 1);
          cash += cashAtDate(g.ref, d) * r;
        }
        /* Immobilien: eigener Wertverlauf ab Kaufdatum, ohne Kursquelle */
        let props = 0;
        for (const g of propGroups) {
          if ((g.ref.buyDate || "") > d) continue;
          props += propValueAt(g.ref, d);
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
        for (const b of activeBms) {
          const ser = filled[`td:${b.sym}`];
          row["bm_" + b.id] = ser && ser[d] != null ? ser[d] : null;
        }
        rows.push(row);
        prev = { d, px };
      }

      setState({ loading: false, rows, notes: [...new Set(notes)], err: rows.length ? "" : "Keine Kursdaten für den Zeitraum gefunden" });
    }
    build();
    return () => { cancelled = true; };
  }, [eligKey, cashKey, propKey, bmKey, cur, tdKey]);

  /* --- Zeitraum zuschneiden, Benchmarks auf Startpunkt normalisieren --- */
  const view = useMemo(() => {
    const r = RANGES.find((x) => x.id === range) || RANGES.find((x) => x.id === "6M");
    let rows = state.rows;
    if (r.ytd) { const from = yearStartIso(); rows = rows.filter((x) => x.d >= from); }
    else if (r.days) { const from = addDays(todayIso(), -r.days); rows = rows.filter((x) => x.d >= from); }
    if (!rows.length) return { rows: [], first: null, last: null };
    const first = rows[0], last = rows[rows.length - 1];
    const bmBase = {};
    for (const b of activeBms) {
      const f = rows.find((x) => x["bm_" + b.id] != null);
      bmBase[b.id] = f ? f["bm_" + b.id] : null;
    }
    const twrBase = first.twr;
    let out = rows.map((x) => {
      const o = { d: x.d, value: x.value, perf: twrBase ? (x.twr / twrBase - 1) * 100 : null };
      for (const b of activeBms) {
        const base = bmBase[b.id];
        o["bm_" + b.id] = base && x["bm_" + b.id] != null ? (x["bm_" + b.id] / base - 1) * 100 : null;
      }
      return o;
    });
    /* für flüssiges Rendern ausdünnen */
    if (out.length > 400) { const step = Math.ceil(out.length / 400); out = out.filter((_, idx) => idx % step === 0 || idx === out.length - 1); }
    return { rows: out, first, last };
  }, [state.rows, range, bmKey]);

  /* Die Darstellung haengt nur noch am Umschalter. Vergleichsindizes werden
     ausschliesslich in der %-Ansicht gezeichnet, blockieren den Wechsel aber nicht. */
  const showPerf = mode === "perf";
  const showBms = showPerf && activeBms.length > 0;
  /* Index einschalten heisst: vergleichen wollen -> aus der Wert-Ansicht automatisch auf % */
  const toggleBm = (id) => {
    const wasOn = benchmarks.includes(id);
    onToggleBenchmark(id);
    if (!wasOn && !showPerf) setMode("perf");
  };
  /* Gewinnänderung im Zeitraum: Buchgewinn-Differenz plus die in dieser Zeit realisierten Gewinne */
  const realizedWin = useMemo(() => {
    if (!view.first || !view.last) return 0;
    let sum = 0;
    for (const g of eligible) for (const m of g.matches || []) {
      if (m.date && m.date > view.first.d && m.date <= view.last.d) sum += m.realized;
    }
    return sum;
  }, [view.first, view.last, eligible]);
  /* Wertänderung im Zeitraum: Buchgewinn der Wertpapiere + realisierte Gewinne
     + Wertsteigerung der Immobilien. Cash-Zuflüsse zählen nicht als Gewinn. */
  const propChg = view.first && view.last ? (view.last.props || 0) - (view.first.props || 0) : 0;
  const chg = view.first && view.last ? (view.last.gain - view.first.gain) + realizedWin + propChg : 0;
  const chgPct = view.first && view.last && view.first.twr ? (view.last.twr / view.first.twr - 1) * 100 : 0;
  const hoverRow = hover != null && view.rows[hover] ? view.rows[hover] : null;
  const fmtDate = (d) => { const x = new Date(d); return `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getFullYear()).slice(2)}`; };
  /* Achsenbeschriftung so genau, dass keine zwei Ticks gleich aussehen:
     die Genauigkeit richtet sich nach der Spannweite der Werte im Zeitraum. */
  const span = useMemo(() => {
    if (!view.rows.length) return 0;
    const vals = view.rows.map((x) => x.value).filter((v) => v != null);
    return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  }, [view.rows]);
  /* Tippen ausserhalb des Charts schliesst die Werte-Box wieder */
  useEffect(() => {
    if (hover == null) return;
    const onDown = (e) => { if (!chartBox.current || !chartBox.current.contains(e.target)) setHover(null); };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [hover]);

  const nf = (v, dec) => v.toLocaleString(CUR === "CHF" ? "de-CH" : "de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const axisVal = (v) => {
    const a = Math.abs(v);
    if (span >= 2e6) return nf(v / 1e6, 1) + " Mio";
    if (span >= 2e5) return nf(v / 1e3, 0) + "k";
    if (span >= 2e4) return nf(v / 1e3, 1) + "k";
    if (a >= 1e6) return nf(v / 1e6, 2) + " Mio";
    return nf(Math.round(v), 0);
  };

  return (
    <Card style={{ paddingBottom: 12 }}>
      <div className="fc-chart-head">
        <div>
          <div className="val">{masked ? MASK : hoverRow ? eur(hoverRow.value) : view.last ? eur(view.last.value) : "–"}</div>
          {hoverRow ? (
            <div className="chg" style={{ color: C.muted }}>
              {fmtDate(hoverRow.d)}
              {showPerf && hoverRow.perf != null && <> · {hoverRow.perf >= 0 ? "+" : ""}{hoverRow.perf.toFixed(1).replace(".", ",")} %</>}
            </div>
          ) : view.first && view.last ? (
            <div className="chg" style={{ color: chg >= 0 ? C.positive : C.error }}>
              {!masked && <>{chg >= 0 ? "+" : ""}{eur(chg)} · </>}{chgPct >= 0 ? "+" : ""}{chgPct.toFixed(1).replace(".", ",")} %
            </div>
          ) : null}
        </div>
        <div className="fc-chart-modes">
          <button className={!showPerf ? "active" : ""} onClick={() => setMode("value")} title={`Wert in ${CUR}`} aria-label={`Wert in ${CUR}`}>{curSym()}</button>
          <button className={showPerf ? "active" : ""} onClick={() => setMode("perf")} title="Entwicklung in Prozent" aria-label="Entwicklung in Prozent">%</button>
        </div>
      </div>

      <div className="fc-ranges">
        {RANGES.map((r) => (
          <button key={r.id} className={range === r.id ? "active" : ""} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
      </div>

      <div ref={chartBox} style={{ width: "100%", height: 236, marginTop: 2 }}>
        {state.loading ? (
          <div className="fc-chart-empty">Kursverlauf wird geladen …</div>
        ) : view.rows.length < 2 ? (
          <div className="fc-chart-empty">{state.err || "Noch keine Daten – Kaufdatum bei den Positionen eintragen."}</div>
        ) : (
          <ResponsiveContainer>
            <LineChart
              data={view.rows}
              margin={{ top: 6, right: 10, bottom: 0, left: 0 }}
              onMouseMove={(s) => setHover(s && s.activeTooltipIndex != null ? s.activeTooltipIndex : null)}
              onTouchMove={(s) => setHover(s && s.activeTooltipIndex != null ? s.activeTooltipIndex : null)}
              onClick={(s) => setHover(s && s.activeTooltipIndex != null ? s.activeTooltipIndex : null)}
              onMouseLeave={() => setHover(null)}
            >
              <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
              <XAxis dataKey="d" tickFormatter={fmtDate} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} minTickGap={38} />
              <YAxis domain={["auto", "auto"]} allowDecimals={false} tickFormatter={(v) => (showPerf ? `${Math.round(v)} %` : masked ? "" : axisVal(v))} width={showPerf ? 46 : masked ? 10 : 58} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} />
              <Tooltip
                active={hover != null}
                labelFormatter={fmtDate}
                formatter={(v, n) => [showPerf ? `${Number(v).toFixed(1).replace(".", ",")} %` : masked ? MASK : eurFull(v), n]}
                contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 12.5, boxShadow: SHADOW }}
                labelStyle={{ color: C.muted }}
                itemStyle={{ color: C.ink }}
                cursor={{ stroke: C.borderStrong, strokeWidth: 1, strokeDasharray: "3 3" }}
                /* Bei nur einer Linie steht der Wert schon im Kopf */
                content={showBms ? undefined : () => null}
              />
              <Line type="monotone" dataKey={showPerf ? "perf" : "value"} name="Portfolio" stroke={C.rausch} strokeWidth={2.4} dot={false} connectNulls />
              {showPerf && activeBms.map((b) => (
                <Line key={b.id} type="monotone" dataKey={"bm_" + b.id} name={b.label} stroke={b.color} strokeWidth={1.7} dot={false} connectNulls strokeDasharray="4 3" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className={`fc-bmrow ${!showPerf ? "dim" : ""}`}>
        {BENCHMARKS.map((b) => {
          const on = benchmarks.includes(b.id);
          return (
            <button key={b.id} className={`fc-bm ${on ? "on" : ""}`} onClick={() => toggleBm(b.id)} style={on ? { borderColor: b.color, color: b.color } : undefined}>
              <span className="dot" style={{ background: on ? b.color : C.borderStrong }} />{b.label}
            </button>
          );
        })}
      </div>

      {!showPerf && activeBms.length > 0 && (
        <div className="fc-chart-note">Vergleichsindizes werden in der %-Ansicht angezeigt.</div>
      )}

      {state.notes.length > 0 && (
        <div className="fc-chart-note">
          {state.notes.slice(0, 2).map((n, i) => <div key={i}>{n}</div>)}
        </div>
      )}
    </Card>
  );
}

/* ---------- Haupt-App ---------- */
export default function App() {
  const [data, setData] = useState(() => loadLS(DATA_KEY, EMPTY));
  const [settings, setSettings] = useState(() => loadLS(SETTINGS_KEY, { finnhubKey: "", currency: "EUR", theme: "system", tdKey: "", calcMode: "surplus", chartBenchmarks: ["sp500"], chartRange: "6M", chartMode: "value", investSort: "size" }));
  CUR = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
  const [tab, setTab] = useState("home");
  const [costView, setCostView] = useState("fix");
  /* Sortierung der Positionsliste liegt in den Settings, damit sie erhalten bleibt */
  const investSort = ["size", "type", "day"].includes(settings.investSort) ? settings.investSort : "size";
  const setInvestSort = (v) => setSettings((x) => ({ ...x, investSort: v }));
  const [sheet, setSheet] = useState(null);
  const [priceStatus, setPriceStatus] = useState("");
  const [priceFailIds, setPriceFailIds] = useState([]);
  const [activeCat, setActiveCat] = useState(-1);
  const [hoverCat, setHoverCat] = useState(-1);
  const [masked, setMasked] = useState(() => { try { return localStorage.getItem("finanz_masked") === "1"; } catch { return false; } });
  const [locked, setLocked] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return !!s.lockEnabled && !sessionUnlocked();
    } catch { return false; }
  });
  const [lockMsg, setLockMsg] = useState("");
  const [undo, setUndo] = useState(null);
  const [search, setSearch] = useState("");
  const [fxRates, setFxRates] = useState({ EUR: 1, USD: 1, CHF: 1 });
  const importRef = useRef(null);

  /* Wechselkurse für Cash-Konten in Fremdwährung (1 Einheit → Anzeigewährung) */
  useEffect(() => {
    let dead = false;
    (async () => {
      const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
      const others = CURRENCIES.filter((c) => c !== cur);
      const next = { [cur]: 1 };
      for (const c of others) {
        const r = await fetchFx(c, cur);
        next[c] = r > 0 ? r : 1;
      }
      if (!dead) setFxRates(next);
    })();
    return () => { dead = true; };
  }, [settings.currency]);

  /* Speichern (debounced) */
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch { /* Speicher voll */ }
    }, 400);
    return () => clearTimeout(t);
  }, [data]);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  useEffect(() => {
    try { localStorage.setItem("finanz_masked", masked ? "1" : "0"); } catch { /* ignore */ }
  }, [masked]);

  /* Entsperren per Biometrie (Face/Fingerprint), OS fällt selbst auf PIN zurück */
  async function unlock() {
    setLockMsg("");
    try {
      const ok = await bioVerify(settings.lockCredId);
      if (ok) { markUnlocked(); setLocked(false); }
      else setLockMsg("Nicht erkannt – bitte erneut versuchen.");
    } catch (e) {
      setLockMsg("Entsperren abgebrochen oder nicht möglich.");
    }
  }

  async function enableLock() {
    setLockMsg("");
    if (!bioAvailable()) { setLockMsg("Dieses Gerät unterstützt keine Biometrie im Browser."); return; }
    try {
      const id = await bioRegister();
      if (id) { markUnlocked(); setSettings((s) => ({ ...s, lockEnabled: true, lockCredId: id })); }
      else setLockMsg("Einrichtung fehlgeschlagen.");
    } catch (e) {
      setLockMsg("Einrichtung abgebrochen. Face ID/Fingerabdruck muss auf dem Gerät aktiv sein.");
    }
  }

  /* ---------- Theme (Hell / Dunkel / System) ---------- */
  const [systemDark, setSystemDark] = useState(() =>
    typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, []);
  const dark = settings.theme === "dark" || (settings.theme !== "light" && systemDark);
  useEffect(() => {
    const bg = dark ? "#151515" : "#ffffff";
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
    m.setAttribute("content", bg);
    document.body.style.background = bg;
  }, [dark]);

  /* Hintergrund-Scroll sperren, solange ein Sheet/Modal offen ist */
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sheet]);

  /* Auto-Tilgung: fällige Abbuchungen beim Start, beim Zurückkehren in den
     Vordergrund und stündlich nachbuchen – so stimmen Restschuld, Nettovermögen
     und alle Dashboard-Zahlen auch, wenn die App tagelang offen bleibt. */
  useEffect(() => {
    const run = () => setData((d) => applyDueCredits(d));
    run();
    const onWake = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    const t = setInterval(run, 3600000);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      clearInterval(t);
    };
  }, []);

  /* Abgeleitete Zahlen */
  const incomeTotal = useMemo(() => data.incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0), [data.incomes]);
  const fixTotal = useMemo(() => data.expenses.filter((e) => e.kind !== "variabel" && e.kind !== "sparen").reduce((s, e) => s + monthly(e), 0), [data.expenses]);
  const varTotal = useMemo(() => data.expenses.filter((e) => e.kind === "variabel").reduce((s, e) => s + monthly(e), 0), [data.expenses]);
  const savingsTotal = useMemo(() => data.expenses.filter((e) => e.kind === "sparen").reduce((s, e) => s + monthly(e), 0), [data.expenses]);
  const costTotal = fixTotal + varTotal;
  const budgetMode = settings.calcMode === "budget";
  const creditRate = useMemo(() => data.credits.reduce((s, c) => s + (Number(c.rate) || 0), 0), [data.credits]);
  const creditBalance = useMemo(() => data.credits.reduce((s, c) => s + (Number(c.balance) || 0), 0), [data.credits]);
  const extraTotal = useMemo(
    () => data.credits.reduce((s, c) => s + (c.extras || []).reduce((a, e) => a + (Number(e.amt) || 0), 0), 0),
    [data.credits],
  );
  const surplus = incomeTotal - costTotal - creditRate;
  /* Budget-Modus: was nach Fixkosten, Krediten und Sparrate für variable Ausgaben bleibt */
  const budgetTotal = incomeTotal - fixTotal - creditRate - savingsTotal;
  const budgetFree = budgetTotal - varTotal;

  /* Kategorien: eingebaute + eigene, inklusive Umbenennungen */
  const fixCats = useMemo(() => catsOf("fix", data), [data.cats, data.catNames]);
  const varCats = useMemo(() => catsOf("variabel", data), [data.cats, data.catNames]);
  const allCats = useMemo(() => [...fixCats, ...varCats, SAVE_CAT], [fixCats, varCats]);
  const catLabel = (id) => (allCats.find((c) => c.id === id) || {}).label || "";
  const catCounts = useMemo(() => {
    const m = {};
    for (const e of data.expenses) m[e.category] = (m[e.category] || 0) + 1;
    return m;
  }, [data.expenses]);

  const catTotals = useMemo(() =>
    allCats.map((c) => ({
      ...c,
      value: data.expenses.filter((e) => e.category === c.id && e.kind !== "sparen").reduce((s, e) => s + monthly(e), 0),
    })).filter((c) => c.value > 0),
  [data.expenses, allCats]);

  const catSum = useMemo(() => catTotals.reduce((a, c) => a + c.value, 0), [catTotals]);
  /* Auswahl (Tap) hat Vorrang, Hover nur als Vorschau auf Desktop */
  const shownCat = activeCat >= 0 && activeCat < catTotals.length
    ? activeCat
    : (hoverCat >= 0 && hoverCat < catTotals.length ? hoverCat : -1);
  const shownCatData = shownCat >= 0 ? catTotals[shownCat] : null;
  const centerVal = masked ? MASK : eurFull(shownCatData ? shownCatData.value : catSum);
  /* Sehr lange Betraege werden kleiner gesetzt, damit sie nie an den Innenring stossen */
  const centerValSize = centerVal.length > 13 ? 14 : centerVal.length > 11 ? 15 : 17;

  /* Verträge, deren Kündigung in den nächsten 60 Tagen fällig wird */
  const dueContracts = useMemo(() => {
    const today = todayIso();
    return data.expenses
      .filter((e) => e.until && e.kind !== "variabel")
      .map((e) => {
        const notice = Number(e.notice) || 0;
        const end = new Date(e.until);
        const deadline = isoDay(new Date(end.getFullYear(), end.getMonth() - notice, end.getDate()));
        return { ...e, deadline, days: daysBetween(today, deadline) };
      })
      .filter((e) => e.days <= 60)
      .sort((a, b) => a.days - b.days);
  }, [data.expenses]);

  /* Positionen zu Gruppen zusammenfassen (mehrere Käufe eines Assets = eine Zeile) */
  const groups = useMemo(
    () => buildGroups(data.investments, data.sells || [], fxRates),
    [data.investments, data.sells, fxRates],
  );
  /* Tagesveränderung einer Gruppe: kommt vom Kursanbieter, gilt pro Symbol.
     Nur verwenden, wenn sie zum aktuellen Kursstand passt (max. 36 h alt). */
  const dayPctOf = (g) => {
    const r = g && g.ref;
    if (!r || typeof r.dayPct !== "number" || !isFinite(r.dayPct)) return null;
    if (r.dayPctAt && Date.now() - r.dayPctAt > 36 * 3600 * 1000) return null;
    return r.dayPct;
  };
  const portfolioValue = useMemo(() => groups.reduce((s, g) => s + g.value, 0), [groups]);
  const portfolioCost = useMemo(() => groups.reduce((s, g) => s + g.cost, 0), [groups]);
  const realizedTotal = useMemo(() => groups.reduce((s, g) => s + g.realized, 0), [groups]);
  const gain = portfolioValue - portfolioCost + realizedTotal;
  const netWorth = portfolioValue - creditBalance;
  /* Cash in Anzeigewährung – Basis für Sondertilgung aus Cash */
  const cashInCur = useMemo(() => {
    const c = data.investments.find((x) => x.type === "cash" && (x.ccy || CUR) === CUR);
    return c ? cashAmount(c) : 0;
  }, [data.investments, settings.currency]);
  const divTotal12 = useMemo(() => {
    const cut = addDays(todayIso(), -365);
    return (data.divs || []).filter((x) => (x.date || "") >= cut).reduce((s, x) => s + (Number(x.amt) || 0), 0);
  }, [data.divs]);
  const lastPriceUpdate = useMemo(() => {
    const ts = data.investments.map((i) => i.priceUpdated || 0);
    return ts.length ? Math.max(...ts) : 0;
  }, [data.investments]);

  /* ---------- Monats-Snapshots: Basis für Delta und Verlauf ---------- */
  const monthKey = new Date().toISOString().slice(0, 7);
  useEffect(() => {
    if (!data.incomes.length && !data.expenses.length && !data.credits.length && !data.investments.length) return;
    setData((d) => {
      const snaps = d.snapshots || [];
      const cur = snaps.find((s) => s.m === monthKey);
      const next = { m: monthKey, net: Math.round(netWorth), pf: Math.round(portfolioValue), debt: Math.round(creditBalance) };
      if (cur && cur.net === next.net && cur.pf === next.pf && cur.debt === next.debt) return d;
      return { ...d, snapshots: [...snaps.filter((s) => s.m !== monthKey), next].sort((a, b) => a.m.localeCompare(b.m)).slice(-120) };
    });
  }, [netWorth, portfolioValue, creditBalance, monthKey]);

  const snapshots = data.snapshots || [];
  /* Veränderung gegenüber dem letzten abgeschlossenen Monat */
  const lastMonthSnap = useMemo(() => {
    const prev = snapshots.filter((s) => s.m < monthKey);
    return prev.length ? prev[prev.length - 1] : null;
  }, [snapshots, monthKey]);
  const netDelta = lastMonthSnap ? netWorth - lastMonthSnap.net : null;
  const monthName = (m) => {
    const [y, mm] = m.split("-");
    return `${["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."][Number(mm) - 1]} ${y.slice(2)}`;
  };

  /* CRUD */
  const save = (key, item) => {
    setData((d) => {
      const list = d[key];
      const exists = item.id && list.some((x) => x.id === item.id);
      return { ...d, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, { ...item, id: uid() }] };
    });
    setSheet(null);
  };
  /* Löschen ohne Rückfrage, dafür 8 Sekunden Rückgängig-Leiste */
  const undoTimer = useRef(null);
  function withUndo(label, mutate) {
    /* Zustand vor der Änderung sichern – ausserhalb des Updaters, damit er
       auch bei mehrfach ausgeführten Updates unverändert bleibt */
    setUndo({ label, before: data });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
    setData((d) => mutate(d));
  }
  function doUndo() {
    if (!undo) return;
    const before = undo.before;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setData(before);
  }
  const remove = (key, id) => {
    const item = (data[key] || []).find((x) => x.id === id);
    withUndo(`${item && item.name ? item.name : "Eintrag"} gelöscht`, (d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) }));
  };

  /* ---------- Verkäufe (FIFO) und Cash ---------- */
  /* Erlös landet automatisch auf dem Cash-Konto in der Anzeigewährung */
  function bookSell(gkey, s) {
    const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
    const sellId = uid();
    const date = s.date || todayIso();
    const proceeds = (Number(s.qty) || 0) * (Number(s.price) || 0);
    setData((d) => {
      const sells = [...(d.sells || []), { id: sellId, gkey, qty: Number(s.qty) || 0, price: Number(s.price) || 0, date }];
      const flow = { id: sellId, d: date, amt: proceeds };
      const idx = d.investments.findIndex((x) => x.type === "cash" && (x.ccy || cur) === cur);
      let investments;
      if (idx >= 0) {
        investments = d.investments.map((x, k) => {
          if (k !== idx) return x;
          const amt = (Number(x.price) || 0) + proceeds;
          return { ...x, price: amt, buyPrice: amt, flows: [...(x.flows || []), flow] };
        });
      } else {
        investments = [...d.investments, {
          id: uid(), type: "cash", name: `Cash ${cur}`, ccy: cur, symbol: "",
          qty: 1, price: proceeds, buyPrice: proceeds, inChart: true, flows: [flow],
        }];
      }
      return { ...d, sells, investments };
    });
    setSheet(null);
  }

  /* Verkauf zurücknehmen: Erlös wieder aus dem Cash-Konto herausrechnen */
  function removeSell(id) {
    withUndo("Verkauf gelöscht", (d) => {
      const s = (d.sells || []).find((x) => x.id === id);
      if (!s) return d;
      const amt = (Number(s.qty) || 0) * (Number(s.price) || 0);
      const investments = d.investments.map((x) => {
        if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === id)) return x;
        const rest = (Number(x.price) || 0) - amt;
        return { ...x, price: rest, buyPrice: rest, flows: x.flows.filter((f) => f.id !== id) };
      });
      return { ...d, sells: d.sells.filter((x) => x.id !== id), investments };
    });
  }

  /* ---------- Kategorien ---------- */
  function addCat(label, kind) {
    const id = `c_${uid()}`;
    setData((d) => {
      const used = (d.cats || []).length;
      return { ...d, cats: [...(d.cats || []), { id, label, kind: kind === "variabel" ? "variabel" : "fix", color: CAT_COLORS[used % CAT_COLORS.length] }] };
    });
    return id;
  }
  function renameCat(id, label) {
    setData((d) => ({ ...d, catNames: { ...(d.catNames || {}), [id]: label } }));
  }
  function removeCat(id) {
    withUndo("Kategorie gelöscht", (d) => ({
      ...d,
      cats: (d.cats || []).filter((c) => c.id !== id),
      catNames: Object.fromEntries(Object.entries(d.catNames || {}).filter(([k]) => k !== id)),
    }));
  }

  /* ---------- Sparziele ---------- */
  function saveGoal(g) {
    setData((d) => {
      const list = d.goals || [];
      const exists = g.id && list.some((x) => x.id === g.id);
      return { ...d, goals: exists ? list.map((x) => (x.id === g.id ? g : x)) : [...list, { ...g, id: uid() }] };
    });
    setSheet(null);
  }
  function addToGoal(id, amt) {
    setData((d) => ({
      ...d,
      goals: (d.goals || []).map((g) => (g.id === id ? { ...g, saved: Math.max(0, (Number(g.saved) || 0) + amt) } : g)),
    }));
  }
  function removeGoal(id) {
    const g = (data.goals || []).find((x) => x.id === id);
    withUndo(`${g ? g.name : "Ziel"} gelöscht`, (d) => ({ ...d, goals: (d.goals || []).filter((x) => x.id !== id) }));
  }

  /* ---------- Dividenden / Zinserträge ---------- */
  function bookDiv(gkey, v) {
    const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
    const id = uid();
    const date = v.date || todayIso();
    const amt = Number(v.amt) || 0;
    setData((d) => {
      const divs = [...(d.divs || []), { id, gkey, amt, date }];
      let investments = d.investments;
      if (v.toCash) {
        const flow = { id, d: date, amt };
        const idx = investments.findIndex((x) => x.type === "cash" && (x.ccy || cur) === cur);
        if (idx >= 0) {
          investments = investments.map((x, k) => {
            if (k !== idx) return x;
            const n = (Number(x.price) || 0) + amt;
            return { ...x, price: n, buyPrice: n, flows: [...(x.flows || []), flow] };
          });
        } else {
          investments = [...investments, { id: uid(), type: "cash", name: `Cash ${cur}`, ccy: cur, symbol: "", qty: 1, price: amt, buyPrice: amt, inChart: true, flows: [flow] }];
        }
      }
      return { ...d, divs, investments };
    });
    setSheet({ type: "group", gkey });
  }
  function removeDiv(id) {
    withUndo("Ausschüttung gelöscht", (d) => ({
      ...d,
      divs: (d.divs || []).filter((x) => x.id !== id),
      investments: d.investments.map((x) => {
        if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === id)) return x;
        const back = (x.flows.find((f) => f.id === id) || {}).amt || 0;
        const rest = (Number(x.price) || 0) - back;
        return { ...x, price: rest, buyPrice: rest, flows: x.flows.filter((f) => f.id !== id) };
      }),
    }));
  }

  /* ---------- Cash-Bewegungen ---------- */
  function bookCashFlow(cashId, amt, date, label) {
    setData((d) => ({
      ...d,
      investments: d.investments.map((x) => {
        if (x.id !== cashId) return x;
        const n = Math.max(0, (Number(x.price) || 0) + amt);
        return { ...x, price: n, buyPrice: n, flows: [...(x.flows || []), { id: uid(), d: date || todayIso(), amt, label }] };
      }),
    }));
    setSheet({ type: "cash", id: cashId });
  }
  function removeCashFlow(cashId, flowId) {
    withUndo("Buchung gelöscht", (d) => ({
      ...d,
      investments: d.investments.map((x) => {
        if (x.id !== cashId) return x;
        const fl = (x.flows || []).find((f) => f.id === flowId);
        if (!fl) return x;
        const n = Math.max(0, (Number(x.price) || 0) - (Number(fl.amt) || 0));
        return { ...x, price: n, buyPrice: n, flows: x.flows.filter((f) => f.id !== flowId) };
      }),
    }));
  }

  /* ---------- Sondertilgungen ---------- */
  function bookExtra(creditId, e) {
    const amt = Number(e.amt) || 0;
    const exId = uid();
    const date = e.date || todayIso();
    const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
    setData((d) => {
      const credits = d.credits.map((c) => {
        if (c.id !== creditId) return c;
        const bal = Math.max(0, (Number(c.balance) || 0) - amt);
        return { ...c, balance: Math.round(bal * 100) / 100, extras: [...(c.extras || []), { id: exId, d: date, amt, fromCash: !!e.fromCash }] };
      });
      let investments = d.investments;
      if (e.fromCash) {
        const idx = investments.findIndex((x) => x.type === "cash" && (x.ccy || cur) === cur);
        if (idx >= 0) {
          investments = investments.map((x, k) => {
            if (k !== idx) return x;
            const n = Math.max(0, (Number(x.price) || 0) - amt);
            return { ...x, price: n, buyPrice: n, flows: [...(x.flows || []), { id: exId, d: date, amt: -amt, label: "Sondertilgung" }] };
          });
        }
      }
      return { ...d, credits, investments };
    });
    setSheet({ type: "creditDetail", id: creditId });
  }
  function removeExtra(creditId, extraId) {
    withUndo("Sondertilgung gelöscht", (d) => ({
      ...d,
      credits: d.credits.map((c) => {
        if (c.id !== creditId) return c;
        const ex = (c.extras || []).find((x) => x.id === extraId);
        if (!ex) return c;
        const bal = (Number(c.balance) || 0) + (Number(ex.amt) || 0);
        /* Falls die Tilgung vom Cash-Konto kam, den Betrag dort zurückbuchen */
        return { ...c, balance: Math.round(bal * 100) / 100, extras: c.extras.filter((x) => x.id !== extraId) };
      }),
      investments: d.investments.map((x) => {
        if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === extraId)) return x;
        const back = (x.flows.find((f) => f.id === extraId) || {}).amt || 0;
        const rest = (Number(x.price) || 0) - back;
        return { ...x, price: rest, buyPrice: rest, flows: x.flows.filter((f) => f.id !== extraId) };
      }),
    }));
  }

  /* Ganze Gruppe löschen: alle Käufe und Verkäufe des Assets */
  function removeGroup(gkey) {
    const g = groups.find((x) => x.gkey === gkey);
    withUndo(`${g ? g.name : "Position"} gelöscht`, (d) => ({
      ...d,
      investments: d.investments.filter((x) => gkeyOf(x) !== gkey),
      sells: (d.sells || []).filter((x) => x.gkey !== gkey),
      divs: (d.divs || []).filter((x) => x.gkey !== gkey),
    }));
  }

  /* Kurse beim Öffnen des Invest-Reiters automatisch nachladen (max. alle 6 Stunden) */
  const autoFetched = useRef(false);
  useEffect(() => {
    if (tab !== "invest" || autoFetched.current) return;
    const stale = !lastPriceUpdate || Date.now() - lastPriceUpdate > 6 * 3600000;
    const priceable = data.investments.some((i) => !VALUE_TYPES.includes(i.type));
    if (stale && priceable) { autoFetched.current = true; refreshPrices(); }
  }, [tab, lastPriceUpdate, data.investments]);

  /* Suchfilter für Listen */
  const q = search.trim().toLowerCase();
  const matches = (...fields) => !q || fields.some((f) => String(f || "").toLowerCase().includes(q));

  /* ---------- Live-Kurse: CoinGecko (Krypto) + Finnhub (Aktien/ETF) ---------- */
  async function refreshPrices() {
    const priceable = data.investments.filter((i) => !VALUE_TYPES.includes(i.type));
    if (!priceable.length) return;
    setPriceStatus("Kurse werden geladen …");
    const notes = [];
    const failed = [];
    const updated = {};   // symbol → price
    const updatedById = {}; // item.id → price (Rohstoffe, TD-Treffer)
    const dayPct = {};      // symbol → Tagesveränderung in %
    const dayPctById = {};  // item.id → Tagesveränderung in %
    const resolved = {};  // symbol → coinId (für künftige Updates cachen)
    const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
    const curLow = cur.toLowerCase();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /* Krypto → CoinGecko (kostenlos, ohne Key, direkt in der gewählten Währung) */
    const cryptos = priceable.filter((i) => i.type === "krypto");
    if (cryptos.length) {
      const symToId = {};
      for (const c of cryptos) {
        const s = (c.symbol || "").toUpperCase();
        let id = c.coinId || CRYPTO_IDS[s];
        if (!id) {
          try {
            const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(s)}`);
            if (r.status === 429) { notes.push("CoinGecko-Limit erreicht – in 1 Min. erneut versuchen"); break; }
            const j = await r.json();
            id = ((j.coins || []).find((x) => (x.symbol || "").toUpperCase() === s) || {}).id;
            await sleep(400); /* Rate-Limit schonen */
          } catch { /* unten als failed markiert */ }
        }
        if (id) { symToId[s] = id; resolved[s] = id; }
        else failed.push(s);
      }
      const ids = Object.values(symToId);
      if (ids.length) {
        try {
          const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${curLow}&include_24hr_change=true`);
          if (r.status === 429) {
            notes.push("CoinGecko-Limit erreicht – in 1 Min. erneut versuchen");
          } else {
            const j = await r.json();
            for (const [s, id] of Object.entries(symToId)) {
              const p = j[id] && j[id][curLow];
              const ch = j[id] && j[id][`${curLow}_24h_change`];
              if (p) { updated[s] = p; if (typeof ch === "number" && isFinite(ch)) dayPct[s] = ch; }
              else failed.push(s);
            }
          }
        } catch {
          notes.push("CoinGecko nicht erreichbar");
        }
      }
    }

    /* Aktien/ETF → zuerst Finnhub (US, USD). Nicht Gefundenes → Twelve Data */
    const stocks = priceable.filter((i) => i.type === "aktie" || i.type === "etf");
    const tdRetry = [];
    if (stocks.length) {
      if (settings.finnhubKey) {
        const usdEur = await fetchFx("USD", cur);
        if (!usdEur) {
          notes.push("Wechselkurs nicht erreichbar – Aktien übersprungen");
        } else {
          let keyInvalid = false;
          for (const s of stocks) {
            const sym = (s.symbol || "").toUpperCase();
            try {
              const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${settings.finnhubKey}`);
              if (res.status === 401 || res.status === 403) { keyInvalid = true; break; }
              if (res.status === 429) { notes.push("Finnhub-Limit erreicht – in 1 Min. erneut versuchen"); break; }
              const q = await res.json();
              if (q && q.c) {
                updated[sym] = q.c * usdEur;
                if (typeof q.dp === "number" && isFinite(q.dp)) dayPct[sym] = q.dp;
              }
              else tdRetry.push(s);
              await sleep(250);
            } catch { tdRetry.push(s); }
          }
          if (keyInvalid) { notes.push("Finnhub-Key ungültig – bitte in den Einstellungen prüfen"); }
        }
      } else {
        tdRetry.push(...stocks);
      }
    }

    /* Edelmetalle → gold-api (USD/Unze, ohne Key) + Umrechnung */
    const metals = priceable.filter((i) => i.type === "rohstoff" && (COMMODITIES.find((c) => c.id === i.commodity) || {}).src === "metal");
    if (metals.length) {
      const fx = await fetchFx("USD", cur);
      if (!fx) { notes.push("Wechselkurs nicht erreichbar – Edelmetalle übersprungen"); }
      else {
        for (const m of metals) {
          const def = COMMODITIES.find((c) => c.id === m.commodity);
          try {
            const j = await fetch(`https://api.gold-api.com/price/${def.sym}`).then((r) => r.json());
            if (j && j.price) updatedById[m.id] = j.price * fx;
            else failed.push(m.name);
          } catch { failed.push(m.name); }
        }
      }
    }

    /* Twelve Data → EU-/nicht-US-Aktien, ETFs (per Ticker oder ISIN) und Öl */
    const tdCommods = priceable.filter((i) => i.type === "rohstoff" && (COMMODITIES.find((c) => c.id === i.commodity) || {}).src === "td");
    if (tdRetry.length || tdCommods.length) {
      if (!settings.tdKey) {
        if (tdRetry.length) notes.push("Für EU-Aktien/ETFs & Öl: Twelve-Data-Key in den Einstellungen hinterlegen");
        else if (tdCommods.length) notes.push("Für Öl: Twelve-Data-Key in den Einstellungen hinterlegen");
      } else {
        const fxCache = {};
        const fxTo = async (ccy) => { if (!ccy) return 0; if (ccy === cur) return 1; if (fxCache[ccy] != null) return fxCache[ccy]; const r = await fetchFx(ccy, cur); fxCache[ccy] = r; return r; };
        for (const s of tdRetry) {
          const sym = (s.symbol || "").trim();
          try {
            const q = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${settings.tdKey}`).then((r) => r.json());
            const px = q && q.close != null ? Number(q.close) : null;
            if (px && q.currency) {
              const r = await fxTo(q.currency);
              if (r) {
                updated[sym.toUpperCase()] = px * r;
                const ch = Number(q.percent_change);
                if (isFinite(ch)) dayPct[sym.toUpperCase()] = ch;
              } else failed.push(sym);
            }
            else if (q && q.code === 429) { notes.push("Twelve-Data-Limit erreicht – in 1 Min. erneut versuchen"); break; }
            else if (q && /Grow|Venture/i.test(q.message || "")) failed.push(`${sym} (EU-Börse nur im kostenpflichtigen Plan)`);
            else failed.push(`${sym} (nicht gefunden)`);
            await sleep(350);
          } catch { failed.push(sym); }
        }
        for (const m of tdCommods) {
          const def = COMMODITIES.find((c) => c.id === m.commodity);
          try {
            const q = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(def.sym)}&apikey=${settings.tdKey}`).then((r) => r.json());
            const px = q && q.close != null ? Number(q.close) : null;
            const ccy = (q && q.currency) || "USD";
            if (px) {
              const r = await fxTo(ccy);
              if (r) {
                updatedById[m.id] = px * r;
                const ch = Number(q.percent_change);
                if (isFinite(ch)) dayPctById[m.id] = ch;
              } else failed.push(m.name);
            }
            else if (q && q.code === 429) { notes.push("Twelve-Data-Limit erreicht – in 1 Min. erneut versuchen"); break; }
            else if (q && /Grow|Venture/i.test(q.message || "")) failed.push(`${m.name} (nur im kostenpflichtigen Plan)`);
            else failed.push(m.name);
            await sleep(350);
          } catch { failed.push(m.name); }
        }
      }
    }

    if (Object.keys(updated).length || Object.keys(updatedById).length || Object.keys(resolved).length) {
      const now = Date.now();
      setData((d) => ({
        ...d,
        investments: d.investments.map((i) => {
          const sym = (i.symbol || "").toUpperCase();
          const p = updatedById[i.id] != null ? updatedById[i.id] : updated[sym];
          const coinId = resolved[sym] || i.coinId;
          const d = dayPctById[i.id] != null ? dayPctById[i.id] : dayPct[sym];
          if (p != null) {
            const next = { ...i, price: Number(p.toFixed(p < 1 ? 4 : 2)), priceUpdated: now, coinId };
            if (d != null) { next.dayPct = Number(d.toFixed(2)); next.dayPctAt = now; }
            return next;
          }
          return coinId !== i.coinId ? { ...i, coinId } : i;
        }),
      }));
    }
    const failIds = priceable.filter((i) => {
      const sym = (i.symbol || "").toUpperCase();
      return updatedById[i.id] == null && updated[sym] == null;
    }).map((i) => i.id);
    setPriceFailIds(failIds);
    setTimeout(() => setPriceFailIds([]), 12000);
    const n = Object.keys(updated).length + Object.keys(updatedById).length;
    const parts = [];
    if (n) parts.push(`${n} von ${priceable.length} Kursen aktualisiert`);
    if (failed.length) parts.push(`Fehlgeschlagen: ${[...new Set(failed)].join(", ")}`);
    parts.push(...notes);
    setPriceStatus(parts.join(" · ") || "Keine Kurse gefunden");
    setTimeout(() => setPriceStatus(""), 12000);
  }

  /* Beim App-Start einmal automatisch aktualisieren */
  const didAutoRefresh = useRef(false);
  useEffect(() => {
    if (didAutoRefresh.current) return;
    didAutoRefresh.current = true;
    if (data.investments.some((i) => !VALUE_TYPES.includes(i.type))) {
      const t = setTimeout(() => refreshPrices(), 800);
      return () => clearTimeout(t);
    }
  }, []);

  /* ---------- Backup: Export / Import ---------- */
  function exportData() {
    const payload = {
      vault: 3,
      exportedAt: new Date().toISOString(),
      data,
      settings: {
        currency: settings.currency || "EUR",
        theme: settings.theme || "system",
        calcMode: settings.calcMode || "surplus",
        finnhubKey: settings.finnhubKey || "",
        tdKey: settings.tdKey || "",
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let txt = String(reader.result || "").replace(/^\uFEFF/, "").trim();
        const parsed = JSON.parse(txt);
        /* Neues Format {vault,data,settings} und altes Format (Daten direkt) unterstützen */
        const d = parsed && parsed.data ? parsed.data : parsed;
        if (!d || typeof d !== "object" || !(d.incomes || d.expenses || d.credits || d.investments)) {
          throw new Error("kein Backup");
        }
        const clean = {
          incomes: Array.isArray(d.incomes) ? d.incomes : [],
          expenses: Array.isArray(d.expenses) ? d.expenses : [],
          credits: Array.isArray(d.credits) ? d.credits : [],
          investments: Array.isArray(d.investments) ? d.investments : [],
          sells: Array.isArray(d.sells) ? d.sells : [],
          divs: Array.isArray(d.divs) ? d.divs : [],
          goals: Array.isArray(d.goals) ? d.goals : [],
          cats: Array.isArray(d.cats) ? d.cats : [],
          catNames: d.catNames && typeof d.catNames === "object" ? d.catNames : {},
          snapshots: Array.isArray(d.snapshots) ? d.snapshots : [],
        };
        setData(clean);
        /* API-Keys & Einstellungen übernehmen – App-Sperre bleibt gerätegebunden */
        const s = parsed && parsed.settings;
        if (s && typeof s === "object") {
          setSettings((prev) => ({
            ...prev,
            currency: CURRENCIES.includes(s.currency) ? s.currency : prev.currency,
            theme: s.theme || prev.theme,
            calcMode: s.calcMode || prev.calcMode,
            finnhubKey: s.finnhubKey != null ? s.finnhubKey : prev.finnhubKey,
            tdKey: s.tdKey != null ? s.tdKey : prev.tdKey,
          }));
        }
        const n = clean.incomes.length + clean.expenses.length + clean.credits.length + clean.investments.length + clean.sells.length;
        setSheet(null);
        setPriceStatus(`Backup importiert – ${n} Einträge${s ? " inkl. API-Keys" : ""}`);
        setTimeout(() => setPriceStatus(""), 8000);
      } catch (e) {
        setPriceStatus("Import fehlgeschlagen – Datei ist kein gültiges Vault-Backup");
        setTimeout(() => setPriceStatus(""), 8000);
      }
    };
    reader.onerror = () => {
      setPriceStatus("Datei konnte nicht gelesen werden");
      setTimeout(() => setPriceStatus(""), 8000);
    };
    reader.readAsText(file);
  }

  const monthLabel = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const eurM = (v) => (masked ? MASK : eur(v));

  const ListItem = ({ lead, title, sub, value, valueColor, tag, onEdit, onDelete, note }) => (
    <div className="fc-item">
      {lead}
      <div className="fc-item-main" onClick={onEdit}>
        <div className="fc-item-title">{title}{tag}</div>
        <div className="fc-item-sub">{sub}</div>
        {note && <div className="fc-note">{note}</div>}
      </div>
      <div className="fc-item-right">
        <div className="fc-item-value" style={{ color: valueColor || C.ink }}>{value}</div>
        <button className="fc-del" onClick={onDelete} aria-label="Löschen">–</button>
      </div>
    </div>
  );

  const isEmpty = !data.incomes.length && !data.expenses.length && !data.credits.length && !data.investments.length;

  return (
    <div className={`fc-root ${dark ? "dark" : ""}`}>
      <style>{`
        .fc-root{--c-canvas:#ffffff;--c-soft:#f7f7f7;--c-strong:#f2f2f2;--c-ink:#222222;--c-body:#3f3f3f;--c-muted:#6a6a6a;--c-mutedSoft:#929292;--c-hairline:#dddddd;--c-hairlineSoft:#ebebeb;--c-borderStrong:#c1c1c1;--c-rausch:#ff385c;--c-rauschActive:#e00b41;--c-rauschDisabled:#ffd1da;--c-luxe:#460479;--c-plus:#92174d;--c-error:#c13515;--c-positive:#1f7a4d;min-height:100vh;background:${C.canvas};color:${C.ink};font-family:${FONT};padding:0 0 92px;max-width:520px;margin:0 auto;}
        .fc-root.dark{--c-canvas:#151515;--c-soft:#1e1e1e;--c-strong:#292929;--c-ink:#f3f1ee;--c-body:#d4d1cc;--c-muted:#9d9891;--c-mutedSoft:#726d67;--c-hairline:#323232;--c-hairlineSoft:#272727;--c-borderStrong:#4c4a47;--c-rausch:#ff5a77;--c-rauschActive:#ff3d5f;--c-rauschDisabled:#5a2a33;--c-luxe:#b598ff;--c-plus:#e86ba0;--c-error:#ff6b5e;--c-positive:#45c98a;}
        .fc-root *{box-sizing:border-box;font-family:inherit;}
        .fc-header{padding:24px 18px 4px;display:flex;justify-content:space-between;align-items:flex-start;}
        .fc-header .eyebrow{font-size:14px;font-weight:500;line-height:1.29;color:${C.muted};}
        .fc-header h1{margin:2px 0 0;font-size:22px;font-weight:500;line-height:1.18;letter-spacing:-0.44px;color:${C.ink};}
        .fc-gear{width:40px;height:40px;border-radius:9999px;border:none;background:${C.strong};color:${C.ink};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-top:6px;}
        .fc-hero{padding:20px 18px 8px;text-align:center;}
        .fc-hero .num{font-size:64px;font-weight:700;line-height:1.1;letter-spacing:-1px;font-variant-numeric:tabular-nums;}
        .fc-hero .lbl{font-size:14px;font-weight:500;color:${C.muted};margin-top:4px;}
        .fc-hero .laurel{color:${C.borderStrong};font-size:22px;vertical-align:18px;padding:0 10px;}
        .fc-card{background:${C.canvas};border:1px solid ${C.hairline};border-radius:14px;padding:16px;margin:0 16px 16px;box-shadow:${SHADOW};}
        .fc-sectiontitle{display:flex;justify-content:space-between;align-items:baseline;margin:24px 18px 10px;font-size:20px;font-weight:600;line-height:1.2;letter-spacing:-0.18px;color:${C.ink};}
        .fc-sectiontitle .fc-sum{font-size:14px;font-weight:500;color:${C.muted};font-variant-numeric:tabular-nums;}
        .fc-kpis{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 16px 4px;}
        .fc-kpi{background:${C.soft};border-radius:14px;padding:14px 16px;}
        /* feste Labelhöhe: Zahlen stehen in allen Kacheln auf derselben Linie,
           auch wenn ein Label einen Button oder Chip enthält */
        .fc-kpi .l{display:flex;align-items:center;min-height:26px;font-size:13px;line-height:1.23;color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fc-kpi .v{font-size:21px;font-weight:700;line-height:1.3;margin-top:2px;font-variant-numeric:tabular-nums;color:${C.ink};}
        .fc-flowbar{display:flex;height:20px;border-radius:9999px;overflow:hidden;gap:2px;}
        .fc-flowbar div{min-width:4px;}
        .fc-flowlegend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:12px;font-size:13px;line-height:1.23;color:${C.muted};}
        .fc-flowlegend i{display:inline-block;width:8px;height:8px;border-radius:9999px;margin-right:6px;}
        .fc-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid ${C.hairlineSoft};}
        .fc-lead{width:40px;height:40px;border-radius:9999px;background:${C.strong};color:${C.ink};display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .fc-monogram{font-size:13px;font-weight:700;letter-spacing:.02em;}
        .fc-logo{width:40px;height:40px;border-radius:9999px;object-fit:contain;background:${C.canvas};border:1px solid ${C.hairlineSoft};flex-shrink:0;}
        .fc-item:last-child{border-bottom:none;padding-bottom:2px;}
        .fc-item:first-child{padding-top:2px;}
        .fc-item-main{flex:1;cursor:pointer;min-width:0;}
        .fc-item-title{font-size:16px;font-weight:600;line-height:1.25;color:${C.ink};}
        .fc-item-sub{font-size:14px;line-height:1.43;color:${C.muted};margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fc-root .sep{color:${C.borderStrong};padding:0 3px;}
        .fc-inforow{display:flex;align-items:center;gap:8px;margin:-2px 0 0;}
        .fc-info{width:26px;height:26px;border-radius:9999px;border:none;background:${C.strong};color:${C.muted};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex-shrink:0;}
        .fc-info:active{background:${C.borderStrong};}
        .fc-infolbl{font-size:13px;color:${C.mutedSoft};cursor:pointer;}
        .fc-item-right{display:flex;align-items:center;gap:12px;}
        .fc-item-value{font-size:16px;font-weight:600;line-height:1.25;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;}
        .fc-del{width:32px;height:32px;border-radius:9999px;border:none;background:${C.strong};color:${C.ink};font-size:16px;line-height:1;cursor:pointer;flex-shrink:0;}
        .fc-undo{position:fixed;left:0;right:0;bottom:calc(66px + env(safe-area-inset-bottom));display:flex;justify-content:center;z-index:60;pointer-events:none;}
        .fc-undo.top{top:calc(12px + env(safe-area-inset-top));bottom:auto;}
        .fc-undo-inner{pointer-events:auto;display:flex;align-items:center;gap:14px;max-width:492px;width:calc(100% - 32px);background:${C.ink};color:${C.canvas};border-radius:12px;padding:12px 14px;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.28);}
        .fc-undo-inner .txt{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fc-undo-inner button{border:none;background:none;color:${C.canvas};font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:underline;flex-shrink:0;}
        /* Ringmitte: nur Betrag + Anteil. Beide absolut positioniert, damit der Betrag
           immer exakt im Kreismittelpunkt sitzt und niemals verschoben wird.
           Innenradius 66px -> sichere Breite in der Mitte 112px. */
        .fc-pie-center{position:absolute;inset:0;pointer-events:none;}
        .fc-pie-center .vl{position:absolute;left:50%;top:50%;transform:translate(-50%,-58%);width:112px;text-align:center;font-size:16px;font-weight:700;color:${C.ink};line-height:1.1;white-space:nowrap;}
        .fc-pie-center .sh{position:absolute;left:50%;top:50%;transform:translate(-50%,10px);width:104px;text-align:center;font-size:11px;color:${C.mutedSoft};line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        /* Kategoriename unter dem Ring: eine Zeile, feste Hoehe (kein Springen),
           volle Kartenbreite - bei extremen Namen Ellipsis als letzte Reserve. */
        .fc-pie-caption{display:flex;align-items:center;justify-content:center;gap:7px;min-height:24px;margin:6px 4px 0;font-size:13px;font-weight:600;color:${C.ink};}
        .fc-pie-caption .dot{width:8px;height:8px;border-radius:50%;flex:none;}
        .fc-pie-caption .tx{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fc-search{position:relative;margin:14px 16px 4px;}
        .fc-search input{width:100%;background:${C.soft};border:1px solid transparent;border-radius:9999px;padding:11px 14px 11px 40px;height:44px;color:${C.ink};font-size:15px;}
        .fc-search input:focus{outline:none;border-color:${C.borderStrong};background:${C.canvas};}
        .fc-search .ic{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:${C.mutedSoft};display:flex;}
        .fc-search .clr{position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:none;color:${C.mutedSoft};cursor:pointer;font-size:16px;padding:4px;}
        .fc-form > .fc-btn.primary{position:sticky;bottom:-28px;z-index:3;box-shadow:0 -14px 18px 8px ${C.canvas};}
        .fc-goal{padding:12px 0;border-bottom:1px solid ${C.hairlineSoft};}
        .fc-goal:last-of-type{border-bottom:none;}
        .fc-goal .top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;}
        .fc-goal .nm{font-size:15px;font-weight:600;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fc-goal .am{font-size:14px;font-variant-numeric:tabular-nums;color:${C.muted};white-space:nowrap;}
        .fc-goal .track{height:8px;border-radius:9999px;background:${C.strong};overflow:hidden;margin:8px 0 5px;}
        .fc-goal .track span{display:block;height:100%;border-radius:9999px;background:${C.positive};}
        .fc-goal .meta{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:${C.mutedSoft};}
        .fc-goal .acts{display:flex;gap:8px;margin-top:8px;}
        .fc-warnrow{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid ${C.hairlineSoft};font-size:14px;}
        .fc-warnrow:last-child{border-bottom:none;}
        .fc-warnrow .nm{flex:1;color:${C.ink};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fc-warnrow .dt{color:${C.error};font-weight:600;white-space:nowrap;}
        .fc-tag.warn{border-color:${C.error};color:${C.error};}
        .fc-catsec{font-size:13px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:${C.mutedSoft};margin:0 0 8px 2px;}
        .fc-catcard{border:1px solid ${C.hairline};border-radius:14px;overflow:hidden;background:${C.canvas};}
        .fc-catrow{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid ${C.hairlineSoft};}
        .fc-catrow:last-child{border-bottom:none;}
        .fc-catrow.editing{background:${C.soft};}
        .fc-catrow .dot{width:10px;height:10px;border-radius:9999px;flex-shrink:0;}
        .fc-catrow .txt{flex:1;min-width:0;}
        .fc-catrow .nm{font-size:15px;font-weight:600;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fc-catrow .sub{font-size:12.5px;color:${C.mutedSoft};margin-top:1px;}
        .fc-catinput{flex:1;min-width:0;background:${C.canvas};border:1px solid ${C.ink};border-radius:8px;padding:8px 10px;color:${C.ink};font-size:15px;font-weight:600;font-family:inherit;}
        .fc-catinput:focus{outline:none;box-shadow:inset 0 0 0 1px ${C.ink};}
        .fc-catrow .acts{display:flex;align-items:center;gap:6px;flex-shrink:0;}
        .fc-catbtn{width:34px;height:34px;border-radius:9999px;border:none;background:${C.strong};color:${C.muted};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;}
        .fc-catbtn:active{background:${C.borderStrong};}
        .fc-catbtn.ok{background:${C.rausch};color:#fff;}
        .fc-catbtn.del{color:${C.error};}
        .fc-catbtn:disabled{opacity:.35;cursor:not-allowed;}
        .fc-planhead,.fc-planrow{display:grid;grid-template-columns:52px 1fr 1fr 1fr;gap:6px;font-variant-numeric:tabular-nums;}
        .fc-planhead{font-size:12px;color:${C.mutedSoft};padding:4px 0 6px;border-bottom:1px solid ${C.hairline};}
        .fc-planhead span+span,.fc-planrow span+span{text-align:right;}
        .fc-plantable{max-height:260px;overflow-y:auto;}
        .fc-planrow{font-size:13.5px;color:${C.body};padding:8px 0;border-bottom:1px solid ${C.hairlineSoft};}
        .fc-planrow span:first-child{font-weight:600;color:${C.ink};}
        .fc-del.armed{width:auto;padding:0 14px;background:${C.error};color:#ffffff;font-size:13px;font-weight:600;}
        .fc-tag{display:inline-block;margin-left:8px;padding:2px 6px;border-radius:9999px;border:1px solid ${C.hairline};font-size:8px;font-weight:700;letter-spacing:.32px;text-transform:uppercase;color:${C.ink};vertical-align:2px;}
        .fc-btn{border:none;border-radius:8px;padding:12px 16px;min-height:48px;font-size:16px;font-weight:500;line-height:1.25;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;text-align:center;}
        .fc-btn.primary{background:${C.rausch};color:#ffffff;}
        .fc-btn.primary:active{background:${C.rauschActive};}
        .fc-btn.primary:disabled{background:${C.rauschDisabled};color:#ffffff;cursor:not-allowed;}
        .fc-btn.ghost{background:${C.canvas};border:1px solid ${C.ink};color:${C.ink};}
        .fc-btn.ghost:disabled{border-color:${C.borderStrong};color:${C.mutedSoft};cursor:not-allowed;}
        .fc-btn.small{width:auto;min-height:0;padding:10px 20px;font-size:14px;border-radius:9999px;}
        .fc-btn:focus-visible,.fc-del:focus-visible,.fc-x:focus-visible,.fc-tab:focus-visible,.fc-gear:focus-visible{outline:2px solid ${C.ink};outline-offset:2px;}
        .fc-field{display:block;margin-bottom:14px;}
        .fc-field span{display:block;font-size:14px;font-weight:500;line-height:1.29;color:${C.muted};margin-bottom:6px;min-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fc-field input,.fc-field select{width:100%;background:${C.canvas};border:1px solid ${C.hairline};border-radius:8px;padding:14px 12px;height:56px;color:${C.ink};font-size:16px;line-height:1.5;appearance:none;}
        .fc-field input:focus,.fc-field select:focus{outline:none;border-color:${C.ink};box-shadow:inset 0 0 0 1px ${C.ink};}
        .fc-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .fc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;z-index:50;}
        .fc-sheet{background:${C.canvas};border-radius:20px 20px 0 0;width:100%;max-width:520px;padding:20px 18px 28px;max-height:88vh;overflow-y:auto;}
        .fc-sheet-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-size:20px;font-weight:600;letter-spacing:-0.18px;color:${C.ink};}
        .fc-x{background:${C.strong};border:none;border-radius:9999px;width:32px;height:32px;color:${C.ink};font-size:14px;cursor:pointer;}
        .fc-tabs{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:center;background:${C.canvas};border-top:1px solid ${C.hairline};z-index:40;padding-bottom:env(safe-area-inset-bottom);}
        .fc-tabs-inner{display:flex;width:100%;max-width:520px;}
        .fc-tab{flex:1;background:transparent;border:none;color:${C.muted};font-size:11px;font-weight:600;padding:10px 2px 12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;}
        .fc-tab .ic{font-size:18px;line-height:1;}
        .fc-tab .u{width:24px;height:2px;border-radius:1px;background:transparent;margin-top:2px;}
        .fc-tab.active{color:${C.ink};}
        .fc-tab.active .u{background:${C.ink};}
        .fc-status{margin:0 18px 12px;font-size:14px;color:${C.body};}
        .fc-gain{font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;}
        .fc-hint{margin:12px 18px 0;font-size:13px;line-height:1.4;color:${C.muted};}
        .fc-note{margin-top:3px;font-size:12.5px;font-weight:500;line-height:1.3;color:${C.error};}
        .fc-hero .lbl{display:flex;align-items:center;justify-content:center;gap:8px;}
        .fc-eye{border:none;background:${C.strong};color:${C.muted};width:26px;height:26px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;}
        .fc-eye:active{background:${C.borderStrong};}
        .fc-flowtoggle{width:100%;background:none;border:none;padding:0;display:flex;align-items:center;gap:10px;cursor:pointer;font-family:inherit;}
        .fc-flowtoggle .fc-flowbar{flex:1;}
        .fc-flowchev{color:${C.mutedSoft};display:inline-flex;transition:transform .2s ease;flex-shrink:0;}
        .fc-flowchev.open{transform:rotate(180deg);}
        .fc-flowlist{margin-top:14px;display:flex;flex-direction:column;gap:2px;}
        .fc-flowrow{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid ${C.hairlineSoft};font-size:14px;}
        .fc-flowrow:last-child{border-bottom:none;}
        .fc-flowrow .dot{width:9px;height:9px;border-radius:9999px;flex-shrink:0;}
        .fc-flowrow .lbl{color:${C.body};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;max-width:42%;}
        .fc-flowrow .track{flex:1 1 auto;height:5px;border-radius:9999px;background:${C.strong};overflow:hidden;min-width:24px;}
        .fc-flowrow .track .fill{display:block;height:100%;border-radius:9999px;}
        .fc-flowrow .amt{font-variant-numeric:tabular-nums;font-weight:600;color:${C.ink};white-space:nowrap;}
        .fc-flowrow .pct{font-variant-numeric:tabular-nums;color:${C.mutedSoft};font-size:12.5px;width:42px;text-align:right;white-space:nowrap;}
        .recharts-wrapper svg:focus,.recharts-wrapper *:focus,.recharts-sector:focus,.recharts-surface:focus{outline:none;}
        .recharts-sector{transition:filter .18s ease;}
        .fc-lock{position:fixed;inset:0;background:${C.canvas};z-index:100;display:flex;align-items:center;justify-content:center;padding:24px;}
        .fc-lock-inner{max-width:340px;width:100%;text-align:center;}
        .fc-lock-inner .ic{width:56px;height:56px;border-radius:9999px;background:${C.strong};color:${C.ink};display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}
        .fc-lock-inner .ttl{font-size:22px;font-weight:600;letter-spacing:-0.3px;color:${C.ink};margin-bottom:6px;}
        .fc-lock-inner .txt{font-size:14px;line-height:1.45;color:${C.muted};margin-bottom:20px;}
        .fc-lock-inner .err{font-size:13px;color:${C.error};margin-top:12px;}
        .fc-lock-alt{margin-top:14px;background:none;border:none;color:${C.mutedSoft};font-size:13px;text-decoration:underline;cursor:pointer;font-family:inherit;}
        .fc-chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
        .fc-chart-head .lbl{font-size:13px;color:${C.muted};}
        .fc-chart-head .val{font-size:26px;font-weight:700;letter-spacing:-0.4px;font-variant-numeric:tabular-nums;color:${C.ink};margin-top:1px;}
        .fc-chart-head .chg{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;margin-top:2px;}
        .fc-chart-modes{display:flex;background:${C.soft};border-radius:9999px;padding:3px;gap:2px;flex-shrink:0;}
        .fc-chart-modes button{border:none;background:transparent;color:${C.muted};font-size:12.5px;font-weight:600;padding:5px 11px;border-radius:9999px;cursor:pointer;font-family:inherit;}
        .fc-chart-modes button.active{background:${C.canvas};color:${C.ink};box-shadow:${SHADOW};}
        .fc-chart-modes button:disabled{opacity:.45;cursor:not-allowed;}
        .fc-bmrow.dim{opacity:.55;}
        .fc-ranges{display:flex;gap:6px;margin-top:12px;}
        .fc-ranges button{flex:1;min-width:0;border:1px solid ${C.hairline};background:transparent;color:${C.muted};font-size:12px;font-weight:600;padding:6px 0;border-radius:9999px;cursor:pointer;font-family:inherit;white-space:nowrap;}
        .fc-ranges button.active{background:${C.strong};color:${C.ink};border-color:${C.borderStrong};}
        .fc-chart-empty{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13.5px;color:${C.muted};padding:0 14px;line-height:1.45;}
        .fc-bmrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;}
        .fc-bm{display:inline-flex;align-items:center;gap:6px;border:1px solid ${C.hairline};background:transparent;color:${C.muted};font-size:12px;font-weight:600;padding:5px 10px;border-radius:9999px;cursor:pointer;font-family:inherit;}
        .fc-bm .dot{width:7px;height:7px;border-radius:9999px;}
        .fc-chart-note{margin-top:10px;font-size:12px;line-height:1.4;color:${C.mutedSoft};display:flex;flex-direction:column;gap:2px;}
        .fc-check{display:flex;align-items:center;gap:10px;background:none;border:none;padding:2px 0 14px;color:${C.body};font-size:14px;cursor:pointer;font-family:inherit;text-align:left;width:100%;}
        .fc-check .box{width:20px;height:20px;border-radius:5px;border:1.5px solid ${C.borderStrong};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;}
        .fc-check .box.on{background:${C.rausch};border-color:${C.rausch};}
        .fc-detail-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;align-items:start;background:${C.soft};border-radius:14px;padding:14px;margin-bottom:4px;}
        .fc-detail-kpis .l{display:block;font-size:12.5px;color:${C.muted};}
        .fc-detail-kpis .v{display:block;font-size:16px;font-weight:700;margin-top:1px;font-variant-numeric:tabular-nums;color:${C.ink};}
        .fc-detail-sec{margin:20px 0 4px;font-size:15px;font-weight:700;color:${C.ink};}
        .fc-detail-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid ${C.hairlineSoft};}
        .fc-detail-row:last-child{border-bottom:none;}
        .fc-detail-row .m{flex:1;min-width:0;cursor:pointer;}
        .fc-detail-row .t{font-size:15px;font-weight:600;color:${C.ink};font-variant-numeric:tabular-nums;}
        .fc-detail-row .s{font-size:13px;color:${C.muted};margin-top:1px;}
        .fc-detail-row .r{display:flex;align-items:center;gap:10px;}
        .fc-detail-row .a{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;color:${C.body};}
        .fc-detail-note{font-size:12.5px;line-height:1.45;color:${C.muted};}
        .fc-mini{background:none;border:none;color:${C.rausch};font-size:13px;font-weight:600;padding:0 0 12px;cursor:pointer;font-family:inherit;text-decoration:underline;}
        .fc-chip{display:inline-flex;align-items:center;gap:4px;border:none;background:${C.strong};color:${C.ink};font-size:11px;font-weight:600;padding:4px 9px;border-radius:9999px;cursor:pointer;font-family:inherit;}
        .fc-chip:active{background:${C.borderStrong};}
        .fc-seg{display:flex;background:${C.soft};border-radius:9999px;padding:4px;margin:14px 16px 4px;gap:4px;}
        .fc-invest-tools{display:flex;align-items:center;gap:8px;margin:14px 16px 4px;}
        .fc-invest-tools .fc-search{margin:0;flex:1;min-width:0;}
        .fc-invest-tools .fc-seg{margin:0;height:44px;align-items:center;flex:1;}
        .fc-invest-tools .fc-seg.compact{flex:none;}
        .fc-seg-icons button{display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 12px;color:${C.muted};}
        .fc-seg-icons button.active{color:${C.ink};}
        .fc-seg button{flex:1;border:none;background:transparent;color:${C.muted};font-size:14px;font-weight:600;padding:9px 0;border-radius:9999px;cursor:pointer;font-family:inherit;}
        .fc-seg button.active{background:${C.canvas};color:${C.ink};box-shadow:${SHADOW};}
        .fc-forecast-row{display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;border-bottom:1px solid ${C.hairlineSoft};font-size:15px;}
        .fc-forecast-row:last-child{border-bottom:none;}
        .fc-forecast-row .fv{font-weight:700;font-variant-numeric:tabular-nums;text-align:right;}
        @media (prefers-reduced-motion: no-preference){
          .fc-sheet{animation:fcUp .22s ease-out;}
          @keyframes fcUp{from{transform:translateY(24px);opacity:.6}to{transform:translateY(0);opacity:1}}
        }
      `}</style>

      {locked && (
        <div className="fc-lock">
          <div className="fc-lock-inner">
            <span className="ic"><Lock size={26} strokeWidth={1.7} /></span>
            <div className="ttl">Vault ist gesperrt</div>
            <div className="txt">Mit Face ID, Fingerabdruck oder Geräte-PIN entsperren.</div>
            <Btn onClick={unlock} style={{ gap: 8 }}><Fingerprint size={17} strokeWidth={1.9} /> Entsperren</Btn>
            {lockMsg && <div className="err">{lockMsg}</div>}
            <button className="fc-lock-alt" onClick={() => { clearUnlocked(); setSettings((s) => ({ ...s, lockEnabled: false, lockCredId: "" })); setLocked(false); }}>
              Sperre deaktivieren
            </button>
          </div>
        </div>
      )}

      {/* Kopf */}
      <div className="fc-header">
        <div>
          <div className="eyebrow">{monthLabel}</div>
          <h1>
            {tab === "home" && "Vault"}
            {tab === "income" && "Einnahmen"}
            {tab === "expenses" && (costView === "fix" ? "Fixkosten" : "Variable Kosten")}
            {tab === "credits" && "Kredite"}
            {tab === "invest" && "Investments"}
          </h1>
        </div>
        <button className="fc-gear" onClick={() => setSheet({ type: "settings" })} aria-label="Einstellungen">
          <Settings size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* ---------- Übersicht ---------- */}
      {tab === "home" && (
        <>
          {isEmpty && (
            <div style={{ marginTop: 12 }}>
              <Empty
                text="Noch keine Daten erfasst. Lege in den Tabs unten los – oder starte mit Beispieldaten, um dir alles anzusehen."
                action={<Btn small onClick={() => setData(DEMO)}>Beispieldaten laden</Btn>}
              />
            </div>
          )}

          {!isEmpty && (
            <div className="fc-hero">
              <div className="num" style={{ color: netWorth >= 0 ? C.ink : C.error }}>
                {eurM(netWorth)}
              </div>
              <div className="lbl">
                Nettovermögen
                <button
                  className="fc-eye"
                  onClick={() => setMasked((m) => !m)}
                  aria-label={masked ? "Beträge anzeigen" : "Beträge verbergen"}
                  title={masked ? "Beträge anzeigen" : "Beträge verbergen"}
                >
                  {masked ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
                </button>
              </div>
              {netDelta != null && !masked && (
                <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: netDelta >= 0 ? C.positive : C.error }}>
                  {netDelta >= 0 ? "+" : ""}{eur(netDelta)} <span style={{ color: C.mutedSoft, fontWeight: 500 }}>seit {monthName(lastMonthSnap.m)}</span>
                </div>
              )}
            </div>
          )}

          <div className="fc-kpis">
            <div className="fc-kpi"><div className="l">Einnahmen</div><div className="v">{eur(incomeTotal)}</div></div>
            <div className="fc-kpi"><div className="l">Gesamtkosten</div><div className="v">{eur(costTotal)}</div></div>
            <div className="fc-kpi">
              <div className="l" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span>{budgetMode ? SAVE_CAT.label : "Überschuss"}</span>
                <button className="fc-chip" onClick={() => setSheet({ type: "forecast" })} aria-label="Prognose öffnen"><TrendingUp size={12} strokeWidth={2} /> Prognose</button>
              </div>
              <div className="v" style={{ color: (budgetMode ? savingsTotal : surplus) >= 0 ? C.positive : C.error }}>{eur(budgetMode ? savingsTotal : surplus)}</div>
            </div>
            <div className="fc-kpi"><div className="l">Portfoliowert</div><div className="v">{eurM(portfolioValue)}</div></div>
          </div>

          {incomeTotal > 0 && (
            <>
              <SectionTitle>Wohin dein Geld fliesst</SectionTitle>
              <Card>
                <CashflowBar catTotals={catTotals} creditRate={creditRate} surplus={surplus} savings={savingsTotal} budgetFree={budgetFree} budgetMode={budgetMode} />
              </Card>
            </>
          )}

          {catTotals.length > 0 && (
            <>
              <SectionTitle>Ausgaben nach Kategorie</SectionTitle>
              <Card>
                <div style={{ position: "relative", width: "100%", height: 210 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={catTotals} dataKey="value" nameKey="label"
                        innerRadius={66} outerRadius={88} paddingAngle={3} stroke="none"
                        activeIndex={shownCat >= 0 ? shownCat : undefined}
                        activeShape={(p) => (
                          <g style={{ filter: "brightness(1.14) saturate(1.05)" }}>
                            <Sector {...p} outerRadius={p.outerRadius + 7} innerRadius={p.innerRadius - 2} cornerRadius={3} />
                          </g>
                        )}
                        onMouseEnter={CAN_HOVER ? (_, idx) => setHoverCat(idx) : undefined}
                        onMouseLeave={CAN_HOVER ? () => setHoverCat(-1) : undefined}
                        onClick={(_, idx) => { setHoverCat(-1); setActiveCat((p) => (p === idx ? -1 : idx)); }}
                        isAnimationActive={false}
                      >
                        {catTotals.map((c, i) => (
                          <Cell
                            key={c.id}
                            fill={c.color}
                            style={{ cursor: "pointer", opacity: shownCat < 0 || shownCat === i ? 1 : 0.42, transition: "opacity .15s" }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Betrag ist der fixe Anker: absolut in der Ringmitte verankert,
                     daher verschiebt ihn kein Text darueber oder darunter. */}
                  <div className="fc-pie-center">
                    <div className="vl" style={{ fontSize: centerValSize }}>{centerVal}</div>
                    <div className="sh">
                      {shownCatData && catSum > 0 ? `${Math.round((shownCatData.value / catSum) * 100)} %` : "pro Monat"}
                    </div>
                  </div>
                </div>

                {/* Kategoriename ausserhalb des Rings: volle Kartenbreite, feste Zeilenhoehe.
                   Damit kann der Name nie den Innenring beruehren und nichts springt. */}
                <div className="fc-pie-caption">
                  {shownCatData && <span className="dot" style={{ background: shownCatData.color }} />}
                  <span className="tx">{shownCatData ? shownCatData.label : "Gesamtausgaben – Kategorie antippen"}</span>
                </div>

              </Card>
            </>
          )}

          {dueContracts.length > 0 && (
            <>
              <SectionTitle>Kündigung fällig</SectionTitle>
              <Card>
                {dueContracts.slice(0, 4).map((e) => (
                  <div className="fc-warnrow" key={e.id}>
                    <span className="nm">{e.name}</span>
                    <span className="dt">
                      {e.days < 0 ? "Frist verstrichen" : e.days === 0 ? "heute" : `in ${e.days} T.`}
                    </span>
                    <button className="fc-chip" onClick={() => { setTab("expenses"); setCostView("fix"); setSheet({ type: "expense", item: e }); }}>Öffnen</button>
                  </div>
                ))}
                <div className="fc-detail-note" style={{ marginTop: 10 }}>
                  Kündigungsfrist läuft bis {fmtDay(dueContracts[0].deadline)} – Vertragsende {fmtDay(dueContracts[0].until)}.
                </div>
              </Card>
            </>
          )}

          {snapshots.length > 1 && (
            <>
              <SectionTitle right={<span className="fc-sum">{snapshots.length} Monate</span>}>Vermögensverlauf</SectionTitle>
              <Card>
                <div style={{ width: "100%", height: 190 }}>
                  <ResponsiveContainer>
                    <LineChart data={snapshots} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
                      <XAxis dataKey="m" tickFormatter={monthName} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} minTickGap={30} />
                      <YAxis domain={["auto", "auto"]} width={58} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline}
                        tickFormatter={(v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} Mio` : v.toLocaleString(CUR === "CHF" ? "de-CH" : "de-DE"))} />
                      <Tooltip
                        labelFormatter={monthName}
                        formatter={(v, n) => [eurFull(v), n === "net" ? "Nettovermögen" : n === "pf" ? "Vermögen" : "Schulden"]}
                        contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 12.5, boxShadow: SHADOW }}
                        labelStyle={{ color: C.muted }}
                        itemStyle={{ color: C.ink }}
                      />
                      <Line type="monotone" dataKey="net" stroke={C.rausch} strokeWidth={2.4} dot={false} />
                      <Line type="monotone" dataKey="pf" stroke={C.positive} strokeWidth={1.6} dot={false} strokeDasharray="4 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="fc-detail-note" style={{ marginTop: 8 }}>
                  Durchgezogen: Nettovermögen · gestrichelt: Vermögen ohne Schulden. Ein Punkt pro Monat, automatisch gespeichert.
                </div>
              </Card>
            </>
          )}

          <SectionTitle right={(data.goals || []).length ? <button className="fc-chip" onClick={() => setSheet({ type: "goal" })}>Neu</button> : null}>Sparziele</SectionTitle>
          <Card>
            {(data.goals || []).length === 0 ? (
              <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.45, marginBottom: 12 }}>
                  Notgroschen, Auto, Urlaub – lege Ziele fest und sieh, wann du sie erreichst.
                </div>
                <Btn small onClick={() => setSheet({ type: "goal" })}>Sparziel anlegen</Btn>
              </div>
            ) : (data.goals || []).map((g) => {
              const target = Number(g.target) || 0;
              const saved = Number(g.saved) || 0;
              const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
              const rest = Math.max(0, target - saved);
              const rate = budgetMode ? savingsTotal : surplus;
              const months = rest > 0 && rate > 0 ? Math.ceil(rest / rate) : rest <= 0 ? 0 : null;
              const dueMonths = g.deadline ? monthsUntil(g.deadline) : null;
              return (
                <div className="fc-goal" key={g.id}>
                  <div className="top">
                    <span className="nm">{g.name}</span>
                    <span className="am">{eur(saved)} / {eur(target)}</span>
                  </div>
                  <div className="track"><span style={{ width: `${pct}%`, background: rest <= 0 ? C.positive : C.rausch }} /></div>
                  <div className="meta">
                    <span>{rest <= 0 ? "Ziel erreicht" : `noch ${eur(rest)}`}</span>
                    <span>
                      {rest <= 0 ? "" : months == null ? "kein Überschuss" : `≈ ${months} Mon.`}
                      {dueMonths != null && rest > 0 && ` · Ziel in ${dueMonths} Mon.`}
                    </span>
                  </div>
                  <div className="acts">
                    <Btn small kind="ghost" onClick={() => setSheet({ type: "goalPay", id: g.id })}>Einzahlen</Btn>
                    <Btn small kind="ghost" onClick={() => setSheet({ type: "goal", item: g })}>Bearbeiten</Btn>
                    <button className="fc-del" onClick={() => removeGoal(g.id)} aria-label="Ziel löschen">–</button>
                  </div>
                </div>
              );
            })}
          </Card>

          {(data.investments.length > 0 || creditBalance > 0) && (
            <>
              <SectionTitle>Vermögen</SectionTitle>
              <Card>
                <div className="fc-item">
                  <div className="fc-item-main"><div className="fc-item-title">Gesamtvermögen</div><div className="fc-item-sub">{groups.length} Position(en)</div></div>
                  <div className="fc-item-value">{eurM(portfolioValue)}</div>
                </div>
                <div className="fc-item">
                  <div className="fc-item-main"><div className="fc-item-title">Restschulden</div></div>
                  <div className="fc-item-value" style={{ color: C.error }}>{masked ? MASK : `−${eur(creditBalance)}`}</div>
                </div>
                <div className="fc-item">
                  <div className="fc-item-main"><div className="fc-item-title" style={{ fontWeight: 700 }}>Nettovermögen</div></div>
                  <div className="fc-item-value" style={{ fontWeight: 700 }}>{eurM(netWorth)}</div>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* ---------- Einnahmen ---------- */}
      {tab === "income" && (
        <>
          <div className="fc-kpis" style={{ gridTemplateColumns: "1fr" }}>
            <div className="fc-kpi"><div className="l">Summe pro Monat</div><div className="v">{eur(incomeTotal)}</div></div>
          </div>
          <div style={{ height: 12 }} />
          {data.incomes.length === 0
            ? <Empty text="Erfasse Gehalt, Kindergeld, Elterngeld und weitere Zuschüsse." action={<Btn small onClick={() => setSheet({ type: "income" })}>Einnahme hinzufügen</Btn>} />
            : <Card>{data.incomes.map((i) => (
                <ListItem key={i.id}
                  lead={<Lead icon={INCOME_ICONS[i.type] || Coins} />}
                  title={i.name}
                  sub={INCOME_TYPES.find((t) => t.id === i.type)?.label}
                  value={eur(i.amount)}
                  onEdit={() => setSheet({ type: "income", item: i })}
                  onDelete={() => remove("incomes", i.id)}
                />
              ))}</Card>}
          <div style={{ margin: "0 16px" }}><Btn onClick={() => setSheet({ type: "income" })}>Einnahme hinzufügen</Btn></div>
        </>
      )}

      {/* ---------- Kosten (Fix / Variabel) ---------- */}
      {tab === "expenses" && (
        <>
          <div className="fc-seg" role="tablist">
            <button className={costView === "fix" ? "active" : ""} onClick={() => setCostView("fix")}>Fixkosten</button>
            <button className={costView === "variabel" ? "active" : ""} onClick={() => setCostView("variabel")}>Variabel</button>
          </div>
          {data.expenses.filter((e) => (costView === "fix" ? e.kind !== "variabel" : e.kind === "variabel")).length > 7 && (
            <SearchBar value={search} onChange={setSearch} placeholder="Kosten suchen" />
          )}
          {costView === "fix" ? (
            <>
              <div className="fc-kpis">
                <div className="fc-kpi"><div className="l">Fixkosten / Monat</div><div className="v">{eur(fixTotal)}</div></div>
                <div className="fc-kpi"><div className="l">Versicherungen</div><div className="v">{eur(catTotals.find((c) => c.id === "versicherung")?.value || 0)}</div></div>
              </div>
              {fixCats.map((cat) => {
                const items = data.expenses.filter((e) => e.category === cat.id && e.kind !== "variabel" && matches(e.name, cat.label));
                if (!items.length) return null;
                return (
                  <React.Fragment key={cat.id}>
                    <SectionTitle right={<span className="fc-sum">{eur(items.reduce((s, e) => s + monthly(e), 0))} / Monat</span>}>{cat.label}</SectionTitle>
                    <Card>
                      {items.map((e) => (
                        <ListItem key={e.id}
                          lead={<Lead icon={ALL_CAT_ICONS[e.category] || Tag} />}
                          title={e.name}
                          tag={e.interval === "jaehrlich" ? <YearTag /> : null}
                          sub={<Sub parts={[
                            e.interval === "jaehrlich" ? `${eurFull(e.amount)} / Jahr` : "monatlich",
                            e.until ? `bis ${fmtDay(e.until)}` : null,
                          ]} />}
                          note={dueContracts.some((x) => x.id === e.id) ? `Kündigung bis ${fmtDay((dueContracts.find((x) => x.id === e.id) || {}).deadline)}` : null}
                          value={eur(monthly(e))}
                          onEdit={() => setSheet({ type: "expense", item: e })}
                          onDelete={() => remove("expenses", e.id)}
                        />
                      ))}
                    </Card>
                  </React.Fragment>
                );
              })}
              {data.expenses.filter((e) => e.kind !== "variabel" && e.kind !== "sparen").length === 0 && <div style={{ marginTop: 12 }}><Empty text="Erfasse Versicherungen, Miete, Abos und andere Fixkosten – monatlich oder jährlich." action={<Btn small onClick={() => setSheet({ type: "expense", kind: "fix" })}>Fixkosten hinzufügen</Btn>} /></div>}
              {budgetMode && (
                <>
                  <SectionTitle right={<span className="fc-sum">{eur(savingsTotal)} / Monat</span>}>{SAVE_CAT.label}</SectionTitle>
                  {data.expenses.filter((e) => e.kind === "sparen").length === 0
                    ? <Empty text="Lege fest, wie viel du jeden Monat fest zur Seite legst. Die Sparrate zählt nicht zu den Gesamtkosten." action={<Btn small onClick={() => setSheet({ type: "expense", kind: "sparen" })}>Sparrate festlegen</Btn>} />
                    : <Card>{data.expenses.filter((e) => e.kind === "sparen").map((e) => (
                        <ListItem key={e.id}
                          lead={<Lead icon={PiggyBank} />}
                          title={e.name}
                          tag={e.interval === "jaehrlich" ? <YearTag /> : null}
                          sub={e.interval === "jaehrlich" ? `${eurFull(e.amount)} / Jahr` : "monatlich"}
                          value={eur(monthly(e))}
                          onEdit={() => setSheet({ type: "expense", item: e })}
                          onDelete={() => remove("expenses", e.id)}
                        />
                      ))}</Card>}
                  <div style={{ margin: "0 16px 16px" }}><Btn kind="ghost" onClick={() => setSheet({ type: "expense", kind: "sparen" })}>Sparrate hinzufügen</Btn></div>
                </>
              )}
              <div style={{ margin: "0 16px" }}><Btn onClick={() => setSheet({ type: "expense", kind: "fix" })}>Fixkosten hinzufügen</Btn></div>
            </>
          ) : (
            <>
              <div className="fc-kpis">
                {budgetMode ? (
                  <>
                    <div className="fc-kpi">
                      <div className="l">Restliches Budget</div>
                      <div className="v" style={{ color: budgetTotal >= 0 ? C.ink : C.error }}>{eur(budgetTotal)}</div>
                      <div style={{ fontSize: 12.5, marginTop: 3, color: budgetFree >= 0 ? C.positive : C.error }}>
                        {budgetFree >= 0 ? `noch frei: ${eur(budgetFree)}` : `überzogen: ${eur(-budgetFree)}`}
                      </div>
                    </div>
                    <div className="fc-kpi"><div className="l">Davon ausgegeben</div><div className="v">{eur(varTotal)}</div></div>
                  </>
                ) : (
                  <>
                    <div className="fc-kpi"><div className="l">Variabel / Monat</div><div className="v">{eur(varTotal)}</div></div>
                    <div className="fc-kpi"><div className="l">Ø pro Tag</div><div className="v">{eur(varTotal / 30)}</div></div>
                  </>
                )}
              </div>
              {varCats.map((cat) => {
                const items = data.expenses.filter((e) => e.category === cat.id && e.kind === "variabel" && matches(e.name, cat.label));
                if (!items.length) return null;
                return (
                  <React.Fragment key={cat.id}>
                    <SectionTitle right={<span className="fc-sum">{eur(items.reduce((s, e) => s + monthly(e), 0))} / Monat</span>}>{cat.label}</SectionTitle>
                    <Card>
                      {items.map((e) => (
                        <ListItem key={e.id}
                          lead={<Lead icon={ALL_CAT_ICONS[e.category] || Tag} />}
                          title={e.name}
                          tag={e.interval === "jaehrlich" ? <YearTag /> : null}
                          sub={e.interval === "jaehrlich" ? `${eurFull(e.amount)} / Jahr` : "monatlich"}
                          value={eur(monthly(e))}
                          onEdit={() => setSheet({ type: "expense", item: e })}
                          onDelete={() => remove("expenses", e.id)}
                        />
                      ))}
                    </Card>
                  </React.Fragment>
                );
              })}
              {data.expenses.filter((e) => e.kind === "variabel").length === 0 && <div style={{ marginTop: 12 }}><Empty text="Erfasse variable Ausgaben wie Lebensmittel, Drogerie, Restaurant oder Urlaub – so siehst du, wohin dein Alltagsgeld fliesst." action={<Btn small onClick={() => setSheet({ type: "expense", kind: "variabel" })}>Ausgabe hinzufügen</Btn>} /></div>}
              <div style={{ margin: "0 16px" }}><Btn onClick={() => setSheet({ type: "expense", kind: "variabel" })}>Variable Kosten hinzufügen</Btn></div>
            </>
          )}
        </>
      )}

      {/* ---------- Kredite ---------- */}
      {tab === "credits" && (
        <>
          <div className="fc-kpis">
            <div className="fc-kpi"><div className="l">Raten / Monat</div><div className="v">{eur(creditRate)}</div></div>
            <div className="fc-kpi"><div className="l">Restschuld gesamt</div><div className="v">{eur(creditBalance)}</div></div>
            {extraTotal > 0 && (
              <div className="fc-kpi">
                <div className="l">Sondertilgungen</div>
                <div className="v" style={{ color: C.positive }}>{eur(extraTotal)}</div>
              </div>
            )}
          </div>
          <div style={{ height: 12 }} />
          {data.credits.length === 0
            ? <Empty text="Erfasse laufende Kredite mit Monatsrate und Restschuld." action={<Btn small onClick={() => setSheet({ type: "credit" })}>Kredit hinzufügen</Btn>} />
            : <Card>{data.credits.map((c) => (
                <ListItem key={c.id}
                  lead={<Lead icon={Landmark} />}
                  title={c.name}
                  sub={<Sub parts={[
                    `Restschuld ${eur(c.balance)}`,
                    c.interest ? `${String(c.interest).replace(".", ",")} %` : null,
                    c.paymentDay ? `am ${c.paymentDay}.` : null,
                  ]} />}
                  value={`${eur(c.rate)}/M.`}
                  onEdit={() => setSheet({ type: "creditDetail", id: c.id })}
                  onDelete={() => remove("credits", c.id)}
                />
              ))}</Card>}
          <div style={{ margin: "0 16px" }}><Btn onClick={() => setSheet({ type: "credit" })}>Kredit hinzufügen</Btn></div>
        </>
      )}

      {/* ---------- Investments ---------- */}
      {tab === "invest" && (
        <>
          <div className="fc-kpis">
            <div className="fc-kpi">
              <div className="l" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span>Portfoliowert</span>
                <button
                  className="fc-eye"
                  onClick={() => setMasked((m) => !m)}
                  aria-label={masked ? "Beträge anzeigen" : "Beträge verbergen"}
                  title={masked ? "Beträge anzeigen" : "Beträge verbergen"}
                >
                  {masked ? <EyeOff size={14} strokeWidth={1.9} /> : <Eye size={14} strokeWidth={1.9} />}
                </button>
              </div>
              <div className="v">{eurM(netWorth)}</div>
            </div>
            <div className="fc-kpi">
              <div className="l">Gewinn / Verlust</div>
              <div className="v" style={{ color: masked ? C.ink : gain >= 0 ? C.positive : C.error }}>{masked ? MASK : `${gain >= 0 ? "+" : ""}${eur(gain)}`}</div>
              {(realizedTotal !== 0 || divTotal12 > 0) && (
                <div style={{ fontSize: 12.5, marginTop: 3, color: C.muted }}>
                  {realizedTotal !== 0 && <>realisiert {masked ? MASK : `${realizedTotal >= 0 ? "+" : ""}${eur(realizedTotal)}`}</>}
                  {realizedTotal !== 0 && divTotal12 > 0 && " · "}
                  {divTotal12 > 0 && <>Ausschüttung {eurM(divTotal12)}</>}
                </div>
              )}
            </div>
          </div>
          {groups.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <PortfolioChart
                groups={groups}
                cur={CURRENCIES.includes(settings.currency) ? settings.currency : "EUR"}
                tdKey={settings.tdKey || ""}
                fxRates={fxRates}
                benchmarks={Array.isArray(settings.chartBenchmarks) ? settings.chartBenchmarks : []}
                onToggleBenchmark={(id) => setSettings((s) => {
                  const list = Array.isArray(s.chartBenchmarks) ? s.chartBenchmarks : [];
                  return { ...s, chartBenchmarks: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
                })}
                masked={masked}
                range={settings.chartRange || "6M"}
                mode={settings.chartMode || "value"}
                onRange={(id) => setSettings((s) => ({ ...s, chartRange: id }))}
                onMode={(m) => setSettings((s) => ({ ...s, chartMode: m }))}
              />
            </div>
          )}
          {groups.length > 1 && (
            <div className="fc-invest-tools">
              {groups.length > 7 && <SearchBar value={search} onChange={setSearch} placeholder="Position suchen" />}
              <div className={`fc-seg fc-seg-icons ${groups.length > 7 ? "compact" : ""}`} role="tablist">
                <button className={investSort === "size" ? "active" : ""} onClick={() => setInvestSort("size")} title="Nach Grösse" aria-label="Nach Grösse sortieren">
                  <ArrowDownWideNarrow size={18} strokeWidth={1.7} />
                </button>
                <button className={investSort === "type" ? "active" : ""} onClick={() => setInvestSort("type")} title="Nach Art" aria-label="Nach Art sortieren">
                  <Layers size={18} strokeWidth={1.7} />
                </button>
                <button className={investSort === "day" ? "active" : ""} onClick={() => setInvestSort("day")} title="Nach Tagesveränderung" aria-label="Nach Tagesveränderung sortieren">
                  <Percent size={18} strokeWidth={1.7} />
                </button>
              </div>
            </div>
          )}
          {priceStatus && <div className="fc-status">{priceStatus}</div>}
          {groups.length === 0
            ? <Empty text="Erfasse Aktien, ETFs und Krypto – der Ticker reicht, Name und Logo kommen automatisch. Auch Immobilien und Cash-Konten lassen sich als Position anlegen." action={<Btn small onClick={() => setSheet({ type: "invest" })}>Position hinzufügen</Btn>} />
            : <Card>{[...groups].filter((g) => matches(g.name, g.ref.symbol)).sort((a, b) => {
                if (investSort === "type") {
                  const ord = { aktie: 0, etf: 1, krypto: 2, rohstoff: 3, immobilie: 4, cash: 5 };
                  const d = (ord[a.type] ?? 9) - (ord[b.type] ?? 9);
                  if (d !== 0) return d;
                }
                if (investSort === "day") {
                  /* Positionen ohne Tagesveränderung (Cash, Immobilien, fehlende Kurse) nach unten */
                  const da = dayPctOf(a), db = dayPctOf(b);
                  if (da == null && db == null) return b.value - a.value;
                  if (da == null) return 1;
                  if (db == null) return -1;
                  if (db !== da) return db - da;
                }
                return b.value - a.value;
              }).map((g) => {
                const isCash = g.type === "cash";
                const isValue = VALUE_TYPES.includes(g.type);
                const unit = g.type === "rohstoff" ? (g.ref.unit || "Einheiten") : "Stück";
                const ccy = g.ref.ccy || CUR;
                const showPct = !isCash && g.cost > 0;
                const pct = showPct ? (g.unreal / g.cost) * 100 : 0;
                const subParts = isCash
                  ? (ccy !== CUR ? [masked ? MASK : money(cashAmount(g.ref), ccy), `Kurs ${(fxRates[ccy] || 1).toFixed(4).replace(".", ",")}`] : ["Cash-Konto"])
                  : g.type === "immobilie"
                    ? ["Immobilie"]
                    : g.qty > 0
                      ? [
                          `${fmtQty(g.qty)} ${g.type === "rohstoff" ? unit : "Stk"}`,
                          masked ? MASK : eur(g.price),
                          g.lots.length > 1 ? `${g.lots.length} Käufe` : null,
                          g.sells.length ? `${g.sells.length} verkauft` : null,
                        ]
                      : ["verkauft", `realisiert ${masked ? MASK : `${g.realized >= 0 ? "+" : ""}${eur(g.realized)}`}`];
                return (
                  <ListItem key={g.gkey}
                    lead={isValue
                      ? <Lead icon={g.type === "immobilie" ? Home : Banknote} />
                      : g.type === "rohstoff"
                        ? <Lead icon={Gem} />
                        : <AssetLogo inv={g.ref} />}
                    title={g.name}
                    sub={<Sub parts={subParts} />}
                    value={
                      <span>
                        {eurM(g.value)}<br />
                        {investSort === "day" ? (
                          <span className="fc-gain" style={{ color: dayPctOf(g) == null ? C.mutedSoft : dayPctOf(g) >= 0 ? C.positive : C.error }}>
                            {dayPctOf(g) == null ? "–" : `${dayPctOf(g) >= 0 ? "+" : ""}${dayPctOf(g).toFixed(1).replace(".", ",")} % Tag`}
                          </span>
                        ) : (
                          <span className="fc-gain" style={{ color: showPct ? (g.unreal >= 0 ? C.positive : C.error) : C.mutedSoft }}>
                            {showPct ? `${g.unreal >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")} %` : "–"}
                          </span>
                        )}
                      </span>
                    }
                    note={g.lots.some((l) => priceFailIds.includes(l.id)) ? "Keine Live-Daten – zum manuellen Eintragen tippen" : null}
                    onEdit={() => setSheet(isCash ? { type: "cash", id: g.ref.id } : isValue ? { type: "invest", item: g.ref } : { type: "group", gkey: g.gkey })}
                    onDelete={() => removeGroup(g.gkey)}
                  />
                );
              })}</Card>}
          <div style={{ margin: "0 16px", display: "flex", gap: 12 }}>
            <Btn onClick={() => setSheet({ type: "invest" })}>+ Position</Btn>
            <Btn kind="ghost" disabled={!data.investments.length || priceStatus.startsWith("Kurse werden")} onClick={refreshPrices}>
              Kurse{lastPriceUpdate > 0 ? ` · ${agoLabel(lastPriceUpdate)}` : " laden"}
            </Btn>
          </div>
          <div className="fc-hint">
            Krypto und Edelmetalle laufen ohne Key, Aktien und ETFs über die API-Keys in den Einstellungen.
            Kurse werden beim Öffnen automatisch geladen, wenn sie älter als sechs Stunden sind.
          </div>
        </>
      )}

      {/* ---------- Sheets ---------- */}
      {sheet?.type === "income" && (
        <Sheet title={sheet.item ? "Einnahme bearbeiten" : "Neue Einnahme"} onClose={() => setSheet(null)}>
          <IncomeForm initial={sheet.item} onSave={(f) => save("incomes", f)} />
        </Sheet>
      )}
      {sheet?.type === "expense" && (
        <Sheet title={sheet.item ? ((sheet.item.kind === "sparen") ? "Sparrate bearbeiten" : "Ausgabe bearbeiten") : ((sheet.kind || "fix") === "variabel" ? "Neue variable Ausgabe" : (sheet.kind === "sparen" ? "Neue Sparrate" : "Neue Fixkosten"))} onClose={() => setSheet(null)}>
          <ExpenseForm
            initial={sheet.item}
            kind={sheet.kind}
            catList={((sheet.item && sheet.item.kind) || sheet.kind) === "variabel" ? varCats : fixCats}
            onAddCat={addCat}
            onSave={(f) => save("expenses", f)}
          />
        </Sheet>
      )}
      {sheet?.type === "forecast" && (
        <Sheet title="Prognose – Vermögensentwicklung" onClose={() => setSheet(null)}>
          <ForecastView surplus={budgetMode ? savingsTotal : surplus} startValue={netWorth} />
        </Sheet>
      )}
      {sheet?.type === "credit" && (
        <Sheet
          title={sheet.item ? "Kredit bearbeiten" : "Neuer Kredit"}
          onClose={() => setSheet(sheet.back ? { type: "creditDetail", id: sheet.back } : null)}
        >
          <CreditForm
            initial={sheet.item}
            onSave={(f) => { save("credits", f); if (sheet.back) setSheet({ type: "creditDetail", id: sheet.back }); }}
          />
        </Sheet>
      )}
      {sheet?.type === "creditDetail" && (() => {
        const c = data.credits.find((x) => x.id === sheet.id);
        if (!c) return null;
        return (
          <Sheet title={c.name} onClose={() => setSheet(null)}>
            <CreditDetail
              credit={c}
              onExtra={() => setSheet({ type: "extra", id: c.id })}
              onPlan={() => setSheet({ type: "plan", id: c.id })}
              onDeleteExtra={(exId) => removeExtra(c.id, exId)}
              onEdit={() => setSheet({ type: "credit", item: c, back: c.id })}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "plan" && (() => {
        const c = data.credits.find((x) => x.id === sheet.id);
        if (!c) return null;
        return (
          <Sheet title={`Tilgungsplan – ${c.name}`} onClose={() => setSheet({ type: "creditDetail", id: c.id })}>
            <AmortView credit={c} />
          </Sheet>
        );
      })()}
      {sheet?.type === "extra" && (() => {
        const c = data.credits.find((x) => x.id === sheet.id);
        if (!c) return null;
        return (
          <Sheet title={`Sondertilgung – ${c.name}`} onClose={() => setSheet({ type: "creditDetail", id: c.id })}>
            <ExtraPaymentForm credit={c} cashAvail={cashInCur} onSave={(e) => bookExtra(c.id, e)} />
          </Sheet>
        );
      })()}
      {sheet?.type === "div" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={`Ausschüttung – ${g.name}`} onClose={() => setSheet({ type: "group", gkey: g.gkey })}>
            <DivForm group={g} onSave={(v) => bookDiv(g.gkey, v)} />
          </Sheet>
        );
      })()}
      {sheet?.type === "cash" && (() => {
        const inv = data.investments.find((x) => x.id === sheet.id);
        if (!inv) return null;
        return (
          <Sheet title={inv.name} onClose={() => setSheet(null)}>
            <CashDetail
              inv={inv}
              fxRates={fxRates}
              onIn={() => setSheet({ type: "cashFlow", id: inv.id, dir: 1 })}
              onOut={() => setSheet({ type: "cashFlow", id: inv.id, dir: -1 })}
              onEdit={() => setSheet({ type: "invest", item: inv, backCash: inv.id })}
              onDeleteFlow={(fid) => removeCashFlow(inv.id, fid)}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "cashFlow" && (() => {
        const inv = data.investments.find((x) => x.id === sheet.id);
        if (!inv) return null;
        const isIn = sheet.dir > 0;
        return (
          <Sheet title={`${isIn ? "Einzahlung" : "Auszahlung"} – ${inv.name}`} onClose={() => setSheet({ type: "cash", id: inv.id })}>
            <AmountForm
              label={`Betrag (${inv.ccy || CUR})`}
              hint={`Aktueller Bestand: ${money(cashAmount(inv), inv.ccy || CUR)}`}
              cta={isIn ? "Einzahlung buchen" : "Auszahlung buchen"}
              onSave={({ amt, date }) => bookCashFlow(inv.id, isIn ? amt : -amt, date, isIn ? "Einzahlung" : "Auszahlung")}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "goal" && (
        <Sheet title={sheet.item ? "Sparziel bearbeiten" : "Neues Sparziel"} onClose={() => setSheet(null)}>
          <GoalForm initial={sheet.item} onSave={saveGoal} />
        </Sheet>
      )}
      {sheet?.type === "goalPay" && (() => {
        const g = (data.goals || []).find((x) => x.id === sheet.id);
        if (!g) return null;
        return (
          <Sheet title={`Einzahlen – ${g.name}`} onClose={() => setSheet(null)}>
            <AmountForm
              label={`Betrag (${curSym()})`}
              hint={`Bisher gespart: ${eurFull(Number(g.saved) || 0)} von ${eurFull(Number(g.target) || 0)}`}
              cta="Einzahlung buchen"
              initialDate={false}
              onSave={({ amt }) => { addToGoal(g.id, amt); setSheet(null); }}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "cats" && (
        <Sheet title="Kategorien" onClose={() => setSheet({ type: "settings" })}>
          <CatManager
            sections={[
              { kind: "fix", label: "Fixkosten", list: fixCats },
              { kind: "variabel", label: "Variable Kosten", list: varCats },
            ]}
            counts={catCounts}
            onRename={renameCat}
            onRemove={removeCat}
          />
        </Sheet>
      )}
      {sheet?.type === "invest" && (
        <Sheet
          title={sheet.item ? "Kauf bearbeiten" : sheet.preset ? `${sheet.preset.name} zukaufen` : "Neue Position"}
          onClose={() => setSheet(sheet.back ? { type: "group", gkey: sheet.back } : sheet.backCash ? { type: "cash", id: sheet.backCash } : null)}
        >
          <InvestForm
            initial={sheet.item || sheet.preset}
            onSave={(f) => { save("investments", f); if (sheet.back) setSheet({ type: "group", gkey: sheet.back }); if (sheet.backCash) setSheet({ type: "cash", id: sheet.backCash }); }}
            finnhubKey={settings.finnhubKey}
          />
        </Sheet>
      )}
      {sheet?.type === "group" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={g.name} onClose={() => setSheet(null)}>
            <AssetDetail
              group={g}
              divs={(data.divs || []).filter((x) => x.gkey === g.gkey)}
              onDiv={() => setSheet({ type: "div", gkey: g.gkey })}
              onDeleteDiv={removeDiv}
              onAddLot={() => setSheet({
                type: "invest",
                back: g.gkey,
                preset: {
                  type: g.type, symbol: g.ref.symbol || "", name: g.name, logoUrl: g.ref.logoUrl || "",
                  coinId: g.ref.coinId, commodity: g.ref.commodity, unit: g.ref.unit,
                  qty: "", buyPrice: "", buyDate: "", price: g.price ? String(g.price) : "", inChart: g.inChart,
                },
              })}
              onEditLot={(l) => setSheet({ type: "invest", item: l, back: g.gkey })}
              onDeleteLot={(id) => setData((d) => ({ ...d, investments: d.investments.filter((x) => x.id !== id) }))}
              onSell={() => setSheet({ type: "sell", gkey: g.gkey })}
              onDeleteSell={removeSell}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "sell" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={`${g.name} verkaufen`} onClose={() => setSheet({ type: "group", gkey: g.gkey })}>
            <SellForm group={g} onSave={(s) => bookSell(g.gkey, s)} />
          </Sheet>
        );
      })()}
      {sheet?.type === "settings" && (
        <Sheet title="Einstellungen" onClose={() => setSheet(null)}>
          <Field label="Berechnung der Übersicht">
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "surplus", label: "Überschuss" }, { id: "budget", label: "Budget" }].map((o) => (
                <Btn key={o.id} kind={(settings.calcMode || "surplus") === o.id ? "primary" : "ghost"} onClick={() => setSettings({ ...settings, calcMode: o.id })} style={{ flex: 1 }}>
                  {o.label}
                </Btn>
              ))}
            </div>
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            <b>Überschuss</b>: zeigt, was am Monatsende übrig bleibt.<br />
            <b>Budget</b>: du legst eine feste Sparrate fest (Reiter Kosten → Fixkosten). Sie zählt nicht zu den Gesamtkosten;
            unter „Variabel“ siehst du stattdessen dein restliches Budget.
          </div>
          <Field label="Kategorien">
            <Btn kind="ghost" onClick={() => setSheet({ type: "cats" })} style={{ gap: 8 }}>
              <Tag size={15} strokeWidth={1.9} /> Kategorien verwalten
            </Btn>
          </Field>
          <Field label="Darstellung">
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "light", label: "Hell", Ic: Sun }, { id: "dark", label: "Dunkel", Ic: Moon }, { id: "system", label: "System", Ic: Monitor }].map((o) => (
                <Btn key={o.id} kind={(settings.theme || "system") === o.id ? "primary" : "ghost"} onClick={() => setSettings({ ...settings, theme: o.id })} style={{ flex: 1, gap: 6 }}>
                  <o.Ic size={15} strokeWidth={1.9} /> {o.label}
                </Btn>
              ))}
            </div>
          </Field>
          <Field label="Währung">
            <div style={{ display: "flex", gap: 8 }}>
              {CURRENCIES.map((c) => (
                <Btn
                  key={c}
                  kind={(CURRENCIES.includes(settings.currency) ? settings.currency : "EUR") === c ? "primary" : "ghost"}
                  onClick={() => setSettings({ ...settings, currency: c })}
                  style={{ flex: 1 }}
                >
                  {c}
                </Btn>
              ))}
            </div>
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            Bestehende Beträge werden nicht umgerechnet – sie gelten in der gewählten Währung.
            Live-Kurse (Aktien &amp; Krypto) werden automatisch in die gewählte Währung umgerechnet.
          </div>
          <Field label="App-Sperre">
            {settings.lockEnabled ? (
              <Btn kind="ghost" onClick={() => { clearUnlocked(); setSettings({ ...settings, lockEnabled: false, lockCredId: "" }); }} style={{ gap: 8 }}>
                <Lock size={15} strokeWidth={1.9} /> Sperre ist aktiv – deaktivieren
              </Btn>
            ) : (
              <Btn kind="ghost" onClick={enableLock} style={{ gap: 8 }}>
                <Fingerprint size={15} strokeWidth={1.9} /> Sperre einrichten
              </Btn>
            )}
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            Schützt die App beim Öffnen. Falls keine Biometrie verfügbar ist, fragt das Gerät automatisch nach PIN/Muster.
            Hinweis: Die Daten liegen unverschlüsselt im Gerätespeicher – die Sperre schützt vor neugierigen Blicken, nicht gegen forensischen Zugriff.
            {lockMsg && <div style={{ color: C.error, marginTop: 6 }}>{lockMsg}</div>}
          </div>
          <Field label="Finnhub API-Key">
            <input
              value={settings.finnhubKey}
              onChange={(e) => setSettings({ ...settings, finnhubKey: e.target.value.trim() })}
              placeholder="z. B. c1a2b3…"
            />
          </Field>
          <Field label="Twelve Data API-Key">
            <input
              value={settings.tdKey || ""}
              onChange={(e) => setSettings({ ...settings, tdKey: e.target.value.trim() })}
              placeholder="z. B. abcd1234…"
            />
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            Finnhub (kostenlos auf finnhub.io) liefert US-Aktien und -ETFs, Twelve Data (twelvedata.com) europäische Wertpapiere und Öl – dort funktioniert als Ticker auch die ISIN.
            Krypto und Edelmetalle laufen ohne Key.
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <Btn kind="ghost" onClick={exportData} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Download size={16} strokeWidth={1.75} /> Backup exportieren
            </Btn>
            <Btn kind="ghost" onClick={() => importRef.current && importRef.current.click()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Upload size={16} strokeWidth={1.75} /> Backup importieren
            </Btn>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json,text/plain,*/*"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) importData(f); e.target.value = ""; }}
            />
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: C.muted }}>
            Deine Daten liegen ausschliesslich lokal auf diesem Gerät (Browser-Speicher) und verlassen es nie – kein Server, kein Konto.
            Um sie auf ein anderes Gerät zu bringen, exportiere hier ein Backup und importiere es dort.
          </div>
        </Sheet>
      )}

      {/* ---------- Rückgängig-Leiste ---------- */}
      {undo && (
        <div className={`fc-undo ${sheet ? "top" : ""}`}>
          <div className="fc-undo-inner">
            <span className="txt">{undo.label}</span>
            <button onClick={doUndo}>Rückgängig</button>
          </div>
        </div>
      )}

      {/* ---------- Tab-Bar ---------- */}
      <nav className="fc-tabs">
        <div className="fc-tabs-inner">
          {[
            { id: "home", label: "Übersicht", ic: LayoutGrid },
            { id: "income", label: "Einnahmen", ic: Wallet },
            { id: "expenses", label: "Kosten", ic: Receipt },
            { id: "credits", label: "Kredite", ic: Landmark },
            { id: "invest", label: "Invest", ic: TrendingUp },
          ].map((t) => (
            <button key={t.id} className={`fc-tab ${tab === t.id ? "active" : ""}`} onClick={() => { setTab(t.id); setSheet(null); setSearch(""); }}>
              <span className="ic" aria-hidden><t.ic size={20} strokeWidth={1.75} /></span>
              {t.label}
              <span className="u" aria-hidden />
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
