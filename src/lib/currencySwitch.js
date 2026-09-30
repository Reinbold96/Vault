/* ---------- Anzeigewährung wechseln ----------
   Beträge ohne eigene Währung gelten in der Anzeigewährung. Beim Wechsel (z. B. EUR → CHF)
   würden sie sonst stillschweigend "umetikettiert" – 1.000 € Kaufkurs wären plötzlich
   1.000 CHF und die Performance stimmte nicht mehr. Darum:
     - Posten, die eine eigene Währung kennen (Einnahmen, Kosten, Cash-Konten), behalten
       ihre bisherige Währung – sie wird nur fest eingetragen, gerechnet wird weiter live.
     - Alles andere (Kaufkurse, Verkäufe, Ausschüttungen, Kredite, Sparziele, Sparpläne,
       Monats-Snapshots) wird einmalig zum aktuellen Kurs umgerechnet. Renditen in %
       bleiben dadurch exakt gleich. */
import { VALUE_TYPES } from "./constants.jsx";
import { roundPrice } from "./currency.js";

const r2 = (v) => Math.round(v * 100) / 100;

export function convertData(d, from, to, rate) {
  if (!from || !to || from === to || !(rate > 0)) return d;
  const m = (v) => (v === "" || v == null ? v : r2((Number(v) || 0) * rate));
  const px = (v) => (v === "" || v == null ? v : roundPrice((Number(v) || 0) * rate));
  const pin = (x) => (x.ccy ? x : { ...x, ccy: from });
  return {
    ...d,
    incomes: (d.incomes || []).map(pin),
    expenses: (d.expenses || []).map(pin),
    credits: (d.credits || []).map((c) => ({
      ...c, rate: m(c.rate), balance: m(c.balance),
      extras: (c.extras || []).map((e) => ({ ...e, amt: m(e.amt) })),
    })),
    investments: (d.investments || []).map((i) => {
      if (i.type === "cash") return pin(i);
      const next = { ...i, buyPrice: px(i.buyPrice), price: px(i.price) };
      /* Kurse kommen beim nächsten Abruf ohnehin in der neuen Währung */
      if (!VALUE_TYPES.includes(i.type)) next.priceUpdated = 0;
      return next;
    }),
    sells: (d.sells || []).map((s) => ({ ...s, price: px(s.price) })),
    divs: (d.divs || []).map((x) => ({ ...x, amt: m(x.amt), ...(x.tax ? { tax: m(x.tax) } : {}) })),
    goals: (d.goals || []).map((g) => ({ ...g, target: m(g.target), saved: m(g.saved) })),
    plans: (d.plans || []).map((p) => ({ ...p, amount: m(p.amount), ...(p.fee ? { fee: m(p.fee) } : {}) })),
    snapshots: (d.snapshots || []).map((s) => ({ ...s, net: Math.round(s.net * rate), pf: Math.round(s.pf * rate), debt: Math.round(s.debt * rate) })),
  };
}

/* Was sich ändern würde – für den Hinweis vor dem Umstellen */
export function conversionSummary(d) {
  const priced = (d.investments || []).filter((i) => i.type !== "cash").length;
  const pinned = [...(d.incomes || []), ...(d.expenses || []), ...(d.investments || []).filter((i) => i.type === "cash")].filter((x) => !x.ccy).length;
  return { priced, pinned, credits: (d.credits || []).length, goals: (d.goals || []).length };
}
