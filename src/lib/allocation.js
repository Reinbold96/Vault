/* ---------- Aufteilung des Portfolios: nach Art, Währung, Region ----------
   Farbe folgt dem Eintrag (fester Slot je Art/Währung/Region), nie dem Rang.
   Die Slots sind gegen Farbfehlsichtigkeit geprüft (dataviz-Validator, hell + dunkel);
   "Unbekannt"/"Sonstige" sind bewusst neutral grau. */
import { INVEST_TYPES } from "./constants.jsx";
import { histKeyOf } from "./finance.js";
import { isUsMic } from "./identifiers.js";

/* Kategorie-Farben als CSS-Variablen (Werte in styles.css, hell/dunkel) */
const V = (i) => `var(--v${i})`;
const NEUTRAL = "var(--c-borderStrong)";

export const TYPE_SLOTS = { aktie: 1, etf: 2, krypto: 3, rohstoff: 4, immobilie: 5, cash: 6 };

export const REGIONS = [
  { id: "na", label: "Nordamerika" },
  { id: "eu", label: "Europa" },
  { id: "ap", label: "Asien-Pazifik" },
  { id: "em", label: "Schwellenländer" },
  { id: "world", label: "Welt" },
  { id: "other", label: "Sonstige" },
];
const REGION_SLOT = { na: 1, eu: 2, ap: 3, em: 4, world: 5 };

/* Land aus der ISIN (Sitz des Emittenten) → Region. Bei Fonds (IE/LU) ist das nur der
   Fondssitz – deshalb gilt das nur für Einzelaktien. */
const COUNTRY_REGION = {
  US: "na", CA: "na",
  DE: "eu", FR: "eu", NL: "eu", BE: "eu", LU: "eu", IE: "eu", AT: "eu", CH: "eu", LI: "eu", IT: "eu", ES: "eu", PT: "eu",
  GB: "eu", JE: "eu", GG: "eu", IM: "eu", DK: "eu", SE: "eu", NO: "eu", FI: "eu", IS: "eu", PL: "eu", CZ: "eu", HU: "eu", GR: "eu",
  JP: "ap", AU: "ap", NZ: "ap", SG: "ap", HK: "ap",
  CN: "em", IN: "em", BR: "em", MX: "em", ZA: "em", KR: "em", TW: "em", ID: "em", TR: "em", SA: "em", TH: "em", MY: "em", CL: "em", PH: "em",
};

/* ETF-Region aus dem Namen – die Indexnamen sind da sehr eindeutig */
export function etfRegionFromName(name) {
  const s = String(name || "");
  if (/emerging|schwellen|\bEM\b|\bEM IMI\b/i.test(s)) return "em";
  if (/all[- ]?world|\bACWI\b|FTSE All|world|global|welt/i.test(s)) return "world";
  if (/S&P ?500|nasdaq|\bUSA?\b|dow jones|russell|north america|nordamerika|\bUS\b/i.test(s)) return "na";
  if (/china|india|indien|brazil|brasil/i.test(s)) return "em";
  if (/europ|stoxx|\bDAX\b|\bMDAX\b|\bSMI\b|FTSE 100|\bUK\b|germany|deutschland|switzerland|schweiz|france|eurozone/i.test(s)) return "eu";
  if (/japan|nikkei|topix|pacific|pazifik|asia|asien|australia|australien/i.test(s)) return "ap";
  return "";
}

export function regionOf(g) {
  const r = g && g.ref ? g.ref : {};
  if (REGIONS.some((x) => x.id === r.region)) return { id: r.region, auto: false };
  const lotWithIsin = (g.lots || []).find((l) => l.isin) || {};
  const isin = String(r.isin || lotWithIsin.isin || "");
  if (g.type === "etf") {
    const byName = etfRegionFromName(g.name);
    if (byName) return { id: byName, auto: true };
    return { id: "", auto: true };
  }
  const cc = isin.slice(0, 2).toUpperCase();
  if (COUNTRY_REGION[cc]) return { id: COUNTRY_REGION[cc], auto: true };
  /* Ohne ISIN: in USD an einer US-Börse gehandelt → Nordamerika (ADRs bitte von Hand ändern) */
  const mic = r.mic || ((g.lots || []).find((l) => l.mic) || {}).mic;
  if (!isin && (r.qccy === "USD" || (mic && isUsMic(mic)))) return { id: "na", auto: true };
  return { id: "", auto: true };
}

/* Handelswährung einer Position: letzter Kursabruf, sonst Kurshistorie, sonst Börse */
const MIC_CCY = { XETR: "EUR", XFRA: "EUR", XSTU: "EUR", XMUN: "EUR", XBER: "EUR", XDUS: "EUR", XHAM: "EUR", XPAR: "EUR", XAMS: "EUR", XMIL: "EUR", XMAD: "EUR", XBRU: "EUR", XWBO: "EUR", XLON: "GBP", XSWX: "CHF", XVTX: "CHF", XTSE: "CAD", XTKS: "JPY", XHKG: "HKD", XASX: "AUD" };
export function tradeCcyOf(g, { hist = {}, cur = "EUR" } = {}) {
  if (g.type === "cash") return g.ref.ccy || cur;
  if (g.type === "immobilie") return cur;
  if (g.type === "krypto") return "Krypto";
  if (g.type === "rohstoff") return "USD";
  if (g.ref.qccy) return g.ref.qccy;
  const h = hist[histKeyOf(g, cur)];
  if (h && h.ccy) return h.ccy;
  const mic = g.ref.mic || ((g.lots || []).find((l) => l.mic) || {}).mic;
  if (mic && MIC_CCY[mic]) return MIC_CCY[mic];
  if (mic && isUsMic(mic)) return "USD";
  const isin = String(g.ref.isin || ((g.lots || []).find((l) => l.isin) || {}).isin || "");
  if (isin.startsWith("US")) return "USD";
  return "";
}
const CCY_SLOT = { EUR: 1, USD: 2, CHF: 3, GBP: 4, Krypto: 5 };

/* Aufteilung: Einträge in festem Slot-Reihenfolge (für den Balken) + nach Grösse (Liste) */
export function allocation(groups, dim, { hist = {}, cur = "EUR" } = {}) {
  const open = groups.filter((g) => (Number(g.value) || 0) > 0.005);
  const buckets = new Map();
  const add = (id, label, color, order, v, g) => {
    if (!buckets.has(id)) buckets.set(id, { id, label, color, order, value: 0, count: 0, unknown: [] });
    const b = buckets.get(id);
    b.value += v; b.count += 1;
    if (g && id === "?") b.unknown.push(g.gkey);
  };
  let base = open;
  if (dim === "region") base = open.filter((g) => g.type === "aktie" || g.type === "etf");
  for (const g of base) {
    const v = Number(g.value) || 0;
    if (dim === "type") {
      const t = INVEST_TYPES.find((x) => x.id === g.type) || { id: g.type, label: g.type };
      const slot = TYPE_SLOTS[g.type];
      add(t.id, t.id === "aktie" ? "Aktien" : t.id === "etf" ? "ETFs" : t.id === "rohstoff" ? "Rohstoffe" : t.id === "immobilie" ? "Immobilien" : t.label, slot ? V(slot) : NEUTRAL, slot || 99, v);
    } else if (dim === "ccy") {
      const c = tradeCcyOf(g, { hist, cur });
      if (!c) add("?", "Unbekannt", NEUTRAL, 99, v, g);
      else if (CCY_SLOT[c]) add(c, c, V(CCY_SLOT[c]), CCY_SLOT[c], v);
      else {
        /* seltene Währungen teilen sich einen Eintrag – kein neuer, generierter Farbton */
        add("other", "Andere", V(6), 6, v);
        const b = buckets.get("other");
        b.codes = [...new Set([...(b.codes || []), c])];
        b.label = `Andere (${b.codes.join(", ")})`;
      }
    } else {
      const r = regionOf(g);
      if (!r.id) add("?", "Nicht zugeordnet", NEUTRAL, 99, v, g);
      else { const def = REGIONS.find((x) => x.id === r.id); const slot = REGION_SLOT[r.id]; add(r.id, def.label, slot ? V(slot) : NEUTRAL, slot || 98, v); }
    }
  }
  const total = [...buckets.values()].reduce((s, b) => s + b.value, 0);
  const list = [...buckets.values()].map((b) => ({ ...b, pct: total > 0 ? (b.value / total) * 100 : 0 }));
  return {
    total,
    bar: [...list].sort((a, b) => a.order - b.order),
    rows: [...list].sort((a, b) => b.value - a.value),
    excluded: dim === "region" ? open.length - base.length : 0,
  };
}

/* Anteil einer Position am offenen Portfolio (0–100) */
export const weightOf = (g, total) => (total > 0 ? ((Number(g.value) || 0) / total) * 100 : 0);
