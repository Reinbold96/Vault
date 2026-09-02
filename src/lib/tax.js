/* ---------- Steuer-Stammdaten und Objektanalyse ----------
   Quelle Tarif: § 32a Abs. 1 EStG i. d. F. ab VZ 2026 (gesetze-im-internet.de, abgerufen 02.09.2026).
   Soli: § 4 SolzG 2026 – Freigrenze 20 350 € / 40 700 €, Milderungszone 11,9 %.
   Kinderfreibetrag 2026: 6 828 € + BEA 2 928 € = 9 756 € je Kind (Zusammenveranlagung). */

export const BUNDESLAENDER = [
  { id: "bw", label: "Baden-Württemberg", grest: 5.0, kist: 8 },
  { id: "by", label: "Bayern", grest: 3.5, kist: 8 },
  { id: "be", label: "Berlin", grest: 6.0, kist: 9 },
  { id: "bb", label: "Brandenburg", grest: 6.5, kist: 9 },
  { id: "hb", label: "Bremen", grest: 5.5, kist: 9 },
  { id: "hh", label: "Hamburg", grest: 5.5, kist: 9 },
  { id: "he", label: "Hessen", grest: 6.0, kist: 9 },
  { id: "mv", label: "Mecklenburg-Vorpommern", grest: 6.0, kist: 9 },
  { id: "ni", label: "Niedersachsen", grest: 5.0, kist: 9 },
  { id: "nw", label: "Nordrhein-Westfalen", grest: 6.5, kist: 9 },
  { id: "rp", label: "Rheinland-Pfalz", grest: 5.0, kist: 9 },
  { id: "sl", label: "Saarland", grest: 6.5, kist: 9 },
  { id: "sn", label: "Sachsen", grest: 5.5, kist: 9 },
  { id: "st", label: "Sachsen-Anhalt", grest: 5.0, kist: 9 },
  { id: "sh", label: "Schleswig-Holstein", grest: 6.5, kist: 9 },
  { id: "th", label: "Thüringen", grest: 5.0, kist: 9 },
];
export const blOf = (id) => BUNDESLAENDER.find((b) => b.id === id) || null;

/* Kinderfreibetrag inkl. BEA je Kind (2026) – volle Höhe bei Zusammenveranlagung */
export const KINDERFREIBETRAG = 9756;

export const n = (v) => {
  const x = Number(v);
  return isFinite(x) ? x : 0;
};
export const has = (v) => v !== "" && v != null && isFinite(Number(v));

/* ---------- Einkommensteuertarif 2026 (§ 32a Abs. 1 EStG) ---------- */
export const TARIF_2026 = {
  grundfreibetrag: 12348,
  zone1Ende: 17799,
  zone2Ende: 69878,
  zone3Ende: 277825,
};
export function estGrundtarif2026(zvE) {
  const x = Math.max(0, Math.floor(zvE));
  const T = TARIF_2026;
  if (x <= T.grundfreibetrag) return 0;
  if (x <= T.zone1Ende) { const y = (x - T.grundfreibetrag) / 10000; return Math.floor((914.51 * y + 1400) * y); }
  if (x <= T.zone2Ende) { const z = (x - T.zone1Ende) / 10000; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
  if (x <= T.zone3Ende) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}
export function einkommensteuer2026(zvE, splitting) {
  return splitting ? 2 * estGrundtarif2026(zvE / 2) : estGrundtarif2026(zvE);
}
/* Solidaritätszuschlag: 5,5 % der ESt, Freigrenze mit Milderungszone (11,9 %) */
export const SOLI_FREIGRENZE_2026 = { einzel: 20350, splitting: 40700 };
export function soli2026(est, splitting) {
  const grenze = splitting ? SOLI_FREIGRENZE_2026.splitting : SOLI_FREIGRENZE_2026.einzel;
  if (est <= grenze) return 0;
  return Math.min(0.055 * est, 0.119 * (est - grenze));
}
/* Gesamte Steuer auf ein zvE inkl. Kirchensteuer + Soli */
export function gesamtSteuer(zvE, opts) {
  const est = einkommensteuer2026(Math.max(0, zvE), opts.splitting);
  const kist = opts.kistPct ? est * (opts.kistPct / 100) : 0;
  return est + kist + soli2026(est, opts.splitting);
}
/* Steuerwirkung eines zusätzlichen (auch negativen) V+V-Ergebnisses.
   Rückgabe > 0 = Mehrsteuer, < 0 = Erstattung. */
export function steuerWirkung(baseZvE, delta, opts) {
  return gesamtSteuer(baseZvE + delta, opts) - gesamtSteuer(baseZvE, opts);
}

/* ---------- Vollständige Wirtschaftlichkeits-Analyse ---------- */
export function objektAnalyse(i, profile) {
  const price = n(i.price);
  const bl = blOf(i.state);
  const grestPct = has(i.grestPct) ? n(i.grestPct) : (bl ? bl.grest : 5);
  const notarPct = has(i.notarPct) ? n(i.notarPct) : 2.0;
  const maklerPct = i.makler ? (has(i.maklerPct) ? n(i.maklerPct) : 3.57) : 0;
  const nkPct = grestPct + notarPct + maklerPct;
  const nk = (price * nkPct) / 100;
  const invest = price + nk;

  const equity = n(i.equity);
  const loan0 = Math.max(0, (i.financeNk ? invest : price) - equity);
  const zinsPct = n(i.zins);
  const tilgPct = has(i.tilgung) ? n(i.tilgung) : 2;
  const annuityY = (loan0 * (zinsPct + tilgPct)) / 100;

  const area = n(i.area);
  const buildShare = (has(i.buildingPct) ? n(i.buildingPct) : 80) / 100;
  const afaPct = (has(i.afaPct) ? n(i.afaPct) : 2) / 100;
  const afaBase = invest * buildShare;
  const afaY = afaBase * afaPct;

  const rentM = has(i.rentPerM2) && area ? n(i.rentPerM2) * area : n(i.rent);
  const rentY = rentM * 12;
  /* Annahmen (optional, Standard 0): Mietsteigerung p. a., Leerstand, Wertsteigerung p. a. */
  const rentGrowth = Math.max(0, n(i.rentGrowth)) / 100;
  const vacancy = Math.min(100, Math.max(0, n(i.vacancy))) / 100;
  const propGrowth = n(i.propGrowth) / 100;

  /* Nicht umlagefähige Kosten – zwei Wirkungen:
     • opsCashY  mindert den Cashflow (tatsächlicher Geldabfluss)
     • opsDeductY mindert das zu versteuernde Ergebnis (Werbungskosten)
     Die Instandhaltungsrücklage mindert nur den Cashflow – steuerlich wirkt sie
     erst bei tatsächlicher Ausgabe, wird hier also konservativ NICHT abgezogen.
     "pauschal" (Standard): ein Prozentsatz der Kaltmiete deckt Verwaltung,
     Instandhaltung und Mietausfallwagnis ab (Richtwert 25 %). */
  let opsCashY, opsDeductY;
  if ((i.costMode || "pauschal") === "detail") {
    const ruecklageY = has(i.maintPerM2) && area ? n(i.maintPerM2) * area : n(i.maintYear);
    const laufendY = n(i.mgmtM) * 12 + n(i.otherM) * 12;
    opsCashY = ruecklageY + laufendY;
    opsDeductY = laufendY;
  } else {
    const pct = has(i.opsPct) ? n(i.opsPct) : 25;
    opsCashY = (rentY * pct) / 100;
    opsDeductY = opsCashY;
  }

  /* Steuerprofil (alles optional) */
  const p = profile || {};
  const hasIncome = has(p.taxIncome);
  const kids = Math.max(0, Math.round(n(p.kids)));
  const kinderFB = kids * KINDERFREIBETRAG;
  const baseZvE = Math.max(0, n(p.taxIncome) - kinderFB);
  const taxOpts = { splitting: !!p.splitting, kistPct: p.church ? (blOf(p.taxState)?.kist || 9) : 0 };
  const flatRate = has(i.flatRate) ? n(i.flatRate) : 42; /* Rückfall-Grenzsteuersatz */

  /* Jahr-1-Kennzahlen über eine 12-Monats-Amortisation */
  const monthTax = (interestY, rentEffY) => {
    const erg = rentEffY - interestY - afaY - opsDeductY; /* steuerl. Ergebnis V+V */
    const wirkung = hasIncome ? steuerWirkung(baseZvE, erg, taxOpts) : erg * (flatRate / 100);
    return { erg, wirkung };
  };

  /* Zeitreihe: monatliche Tilgung, jährliche Aggregation */
  const horizon = Math.min(40, Math.max(1, has(i.horizon) ? Math.round(n(i.horizon)) : 30));
  const rate = zinsPct / 100 / 12;
  let bal = loan0;
  let val = price;
  let rentEffY = rentM * 12 * (1 - vacancy);
  const rows = [];
  let kumCash = 0, interestY1 = 0, rentEffY1 = rentEffY, tilgY1 = 0;
  for (let yr = 1; yr <= horizon; yr++) {
    let interestY = 0, principalY = 0;
    for (let m = 0; m < 12; m++) {
      if (bal > 0 && annuityY > 0) {
        const int = bal * rate;
        const prin = Math.min(bal, annuityY / 12 - int);
        if (prin <= 0) { interestY += annuityY / 12; continue; } /* Zins > Rate: keine Tilgung */
        interestY += int; principalY += prin; bal = Math.max(0, bal - prin);
      }
    }
    const { erg, wirkung } = monthTax(interestY, rentEffY);
    const paidAnnuity = annuityY > 0 ? interestY + principalY : 0;
    const cashY = rentEffY - paidAnnuity - opsCashY - wirkung; /* echter Netto-Cashflow n. St. */
    kumCash += cashY;
    val = val * (1 + propGrowth);
    rows.push({
      year: yr, rest: Math.round(bal), wert: Math.round(val),
      equity: Math.round(val - bal), kum: Math.round(kumCash),
    });
    if (yr === 1) { interestY1 = interestY; rentEffY1 = rentEffY; tilgY1 = principalY; }
    rentEffY = rentEffY * (1 + rentGrowth);
  }

  /* Jahr-1-Snapshot */
  const { erg: ergJ1, wirkung: steuerJ1 } = monthTax(interestY1, rentEffY1);
  void ergJ1;
  const paidAnnuityY1 = annuityY > 0 ? interestY1 + tilgY1 : 0;
  const cashBeforeTaxY = rentEffY1 - paidAnnuityY1 - opsCashY;
  const cashAfterTaxY = cashBeforeTaxY - steuerJ1;

  return {
    price, nk, nkPct, invest, loan0, annuityY, area,
    grestPct, notarPct, maklerPct,
    afaBase, afaY, opsCashY, opsDeductY, rentM, rentY,
    interestY1, tilgY1, ergJ1, steuerJ1,
    cashBeforeTaxM: cashBeforeTaxY / 12,
    cashAfterTaxM: cashAfterTaxY / 12,
    grossYield: price > 0 ? (rentY / price) * 100 : 0,
    netYield: invest > 0 ? ((rentEffY1 - opsCashY) / invest) * 100 : 0,
    factor: rentY > 0 ? price / rentY : 0,
    equityYield: equity > 0 ? ((cashAfterTaxY + tilgY1 + price * propGrowth) / equity) * 100 : 0,
    equity, hasIncome, usedRate: hasIncome ? null : flatRate,
    rows, horizon,
    verdict: cashAfterTaxY > 30 ? "pos" : cashAfterTaxY < -30 ? "neg" : "flat",
  };
}
