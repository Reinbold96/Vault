/* ---------- Währung (EUR / USD / CHF) ----------
   Die Anzeigewährung ist Modul-Zustand, damit die Formatierer überall ohne
   Context nutzbar bleiben. App setzt sie über setCurrency() im State-Initializer
   und bei Änderung der Einstellung – nie mitten im Render. */
import { CURRENCIES } from "./constants.jsx";

let CUR = "EUR";
export const getCur = () => CUR;
export const setCurrency = (c) => { CUR = CURRENCIES.includes(c) ? c : "EUR"; return CUR; };
export const locale = () => (CUR === "CHF" ? "de-CH" : "de-DE");
export const curSym = () => (CUR === "EUR" ? "€" : CUR === "USD" ? "$" : "CHF");
export const eur = (v) =>
  new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: CUR,
    maximumFractionDigits: Math.abs(v) < 10 && v !== 0 ? 2 : 0,
  }).format(v || 0);
export const eurFull = (v) =>
  new Intl.NumberFormat(locale(), { style: "currency", currency: CUR }).format(v || 0);
/* Betrag in einer beliebigen Währung (für Cash-Konten in Fremdwährung) */
export const money = (v, ccy) =>
  new Intl.NumberFormat(ccy === "CHF" ? "de-CH" : "de-DE", { style: "currency", currency: ccy || CUR }).format(v || 0);
/* Stückzahlen kompakt: bis 8 Dezimalstellen, ohne unnötige Nullen */
export const fmtQty = (v) => {
  const n = Number(v) || 0;
  const s = Math.abs(n) >= 1 ? n.toFixed(Math.abs(n % 1) < 1e-9 ? 0 : 4) : n.toFixed(8);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(".", ",");
};
export const fmtDay = (iso) => {
  if (!iso) return "–";
  const [y, m, d] = String(iso).split("-");
  return d ? `${d}.${m}.${y}` : String(iso);
};

/* Kurs speichern: signifikante Stellen statt fester Nachkommastellen, damit
   Micro-Cap-Kurse (0,00001234) nicht zu 0 werden. */
export const roundPrice = (p) => Number(Number(p).toPrecision(8));

/* Eingabe eines Betrags parsen (Komma ODER Punkt als Dezimaltrenner).
   Ein Punkt gilt nur dann als Tausendertrenner, wenn ein Komma vorkommt
   oder mehrere Punktgruppen vorhanden sind ("1.250.000"). "0.123" ist 0,123. */
export function parseAmount(s) {
  let clean = String(s).replace(/[^\d.,-]/g, "");
  if (clean === "" || clean === "-") return "";
  const dots = (clean.match(/\./g) || []).length;
  const hasComma = clean.includes(",");
  if (hasComma) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (dots > 1) {
    clean = clean.replace(/\./g, "");
  } else if (dots === 1) {
    const [int, frac] = clean.split(".");
    /* "1.250" ohne Komma: Tausender, wenn genau 3 Nachstellen und Vorzahl ≥ 1 */
    if (frac.length === 3 && /^-?[1-9]\d*$/.test(int)) clean = int + frac;
  }
  return clean === "" || clean === "-" ? "" : clean;
}
