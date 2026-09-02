import {
  Shield, Home, Car, Repeat, ShoppingCart, MoreHorizontal,
  Wallet, Baby, HeartHandshake, Coins, Heart, Stethoscope, Users,
  Sofa, Sparkles, Fuel, ShoppingBag, Plane, Gamepad2, Utensils, Shirt, GraduationCap, PiggyBank,
} from "lucide-react";

/* ---------- Airbnb Design Tokens (aus DESIGN-airbnb.md) ---------- */
export const C = {
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

export const FONT = "Inter, -apple-system, system-ui, Roboto, 'Helvetica Neue', sans-serif";
export const SHADOW = "rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px 0, rgba(0,0,0,0.1) 0 4px 8px 0";
export const EXPENSE_CATS = [
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

export const INCOME_TYPES = [
  { id: "gehalt", label: "Gehalt" },
  { id: "kindergeld", label: "Kindergeld" },
  { id: "elterngeld", label: "Elterngeld" },
  { id: "sonstiges", label: "Sonstiges" },
];

export const INVEST_TYPES = [
  { id: "aktie", label: "Aktie" },
  { id: "etf", label: "ETF" },
  { id: "krypto", label: "Krypto" },
  { id: "rohstoff", label: "Rohstoff" },
  { id: "immobilie", label: "Immobilie" },
  { id: "cash", label: "Cash" },
];

/* Rohstoffe: Edelmetalle keyless via gold-api (USD/Unze); Öl via Twelve Data */
export const COMMODITIES = [
  { id: "gold", label: "Gold", unit: "Unzen", src: "metal", sym: "XAU" },
  { id: "silber", label: "Silber", unit: "Unzen", src: "metal", sym: "XAG" },
  { id: "platin", label: "Platin", unit: "Unzen", src: "metal", sym: "XPT" },
  { id: "palladium", label: "Palladium", unit: "Unzen", src: "metal", sym: "XPD" },
  { id: "wti", label: "Öl (WTI)", unit: "Barrel", src: "td", sym: "WTI/USD" },
  { id: "brent", label: "Öl (Brent)", unit: "Barrel", src: "td", sym: "BRENT/USD" },
];

export const CAT_ICONS = {
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

export const INCOME_ICONS = {
  gehalt: Wallet,
  kindergeld: Baby,
  elterngeld: HeartHandshake,
  sonstiges: Coins,
};

/* ---------- Variable Kostenkategorien ---------- */
export const VARIABLE_CATS = [
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
export const VAR_CAT_ICONS = {
  v_lebensmittel: ShoppingCart, v_haushalt: Sofa, v_drogerie: Sparkles,
  v_mobilitaet: Fuel, v_anschaffung: ShoppingBag, v_urlaub: Plane,
  v_restaurant: Utensils, v_freizeit: Gamepad2, v_kleidung: Shirt,
  v_gesundheit: Stethoscope, v_bildung: GraduationCap, v_sonstiges: MoreHorizontal,
};
/* Sparrate (nur im Budget-Modus): zählt NICHT zu den Gesamtkosten */
export const SAVE_CAT = { id: "sparen", label: "Sparrate", color: "#2f9e6e" };
export const ALL_CATS = [...EXPENSE_CATS, ...VARIABLE_CATS, SAVE_CAT];
export const ALL_CAT_ICONS = { ...CAT_ICONS, ...VAR_CAT_ICONS, sparen: PiggyBank };

/* Farbpalette für selbst angelegte Kategorien */
export const CAT_COLORS = ["#8a5a2b", "#4a7d6d", "#d68f6f", "#5b8fb0", "#7a6ff0", "#c17d3a", "#3f7d99", "#9e6b8f", "#6b8f3f"];
/* Kategorien einer Art: eingebaute plus eigene, mit möglichen Umbenennungen */
export function catsOf(kind, data) {
  const base = kind === "variabel" ? VARIABLE_CATS : EXPENSE_CATS;
  const custom = (data.cats || []).filter((c) => (c.kind || "fix") === kind);
  const names = data.catNames || {};
  return [...base, ...custom].map((c) => ({ ...c, label: names[c.id] || c.label, custom: !base.includes(c) }));
}

/* Bekannte Ticker: sofortige Namens-/Typ-Erkennung ohne Netz */
export const KNOWN_ASSETS = {
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
export const CRYPTO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
  ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot", LTC: "litecoin",
  LINK: "chainlink", AVAX: "avalanche-2", MATIC: "matic-network",
  BNB: "binancecoin", TRX: "tron", XLM: "stellar",
};

/* Ticker → Domain für die Logo-Fallback-Kette */
export const TICKER_DOMAINS = {
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

/* Sichtbare Versionskennung – kommt aus package.json (vite define) */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

/* Zensur-Maske für Vermögenswerte */
export const MASK = "*****";

export const CURRENCIES = ["EUR", "USD", "CHF"];

/* Indizes sind bei Twelve Data kostenpflichtig – wir nutzen liquide ETF-Stellvertreter. */
export const BENCHMARKS = [
  { id: "sp500", label: "S&P 500", sym: "SPY", color: "#4a96eb" },
  { id: "nasdaq", label: "Nasdaq", sym: "QQQ", color: "#b598ff" },
  { id: "world", label: "World", sym: "URTH", color: "#f0a83a" },
  { id: "dax", label: "DAX", sym: "EWG", color: "#45c98a" },
];
/* Typen, für die es kostenlose Kurshistorie gibt */
export const HIST_TYPES = ["aktie", "etf", "krypto"];
export const HIST_KEY = "vault_hist_v1";
export const CRYPTO_MAX_DAYS = 365; /* CoinGecko-Gratislimit */

/* Typen mit festem Wert statt Stückzahl × Kurs */
export const VALUE_TYPES = ["immobilie", "cash"];
export const RANGES = [
  { id: "1M", label: "1M", days: 30 },
  { id: "6M", label: "6M", days: 182 },
  { id: "YTD", label: "YTD", days: 0, ytd: true },
  { id: "1J", label: "1J", days: 365 },
  { id: "MAX", label: "Max", days: 0 },
];
