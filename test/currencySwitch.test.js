import { describe, it, expect } from "vitest";
import { convertData } from "../src/lib/currencySwitch.js";
import { buildGroups, monthlyIn, fxOf } from "../src/lib/finance.js";
import { setCurrency } from "../src/lib/currency.js";

describe("Währungswechsel", () => {
  const d = {
    incomes: [{ id: "i", name: "Lohn", amount: 5000, ccy: "CHF" }, { id: "i2", name: "Miete Einnahme", amount: 800 }],
    expenses: [{ id: "e", name: "Miete", amount: 1200 }],
    credits: [{ id: "k", rate: 300, balance: 10000, extras: [{ id: "x", amt: 1000 }] }],
    investments: [
      { id: "a", type: "aktie", symbol: "AAPL", qty: 10, buyPrice: 100, price: 150, priceUpdated: 5 },
      { id: "c", type: "cash", qty: 1, price: 2000 },
    ],
    sells: [{ id: "s", gkey: "aktie:AAPL", qty: 2, price: 140, date: "2025-01-01" }],
    divs: [{ id: "d", gkey: "aktie:AAPL", amt: 10, tax: 2.5, date: "2025-01-01" }],
    goals: [{ id: "g", target: 1000, saved: 200 }],
    plans: [{ id: "p", amount: 50 }],
    snapshots: [{ m: "2025-01", net: 10000, pf: 5000, debt: 1000 }],
  };
  it("rechnet Kaufkurse um – die Rendite in % bleibt gleich", () => {
    const out = convertData(d, "EUR", "CHF", 0.95);
    const before = buildGroups(d.investments, d.sells, {})[0];
    setCurrency("CHF");
    const after = buildGroups(out.investments, out.sells, { EUR: 1 / 0.95, CHF: 1 })[0];
    setCurrency("EUR");
    expect(after.unreal / after.cost).toBeCloseTo(before.unreal / before.cost, 6);
    expect(out.investments[0].priceUpdated).toBe(0);
    expect(out.sells[0].price).toBeCloseTo(133);
    expect(out.divs[0]).toMatchObject({ amt: 9.5, tax: 2.38 });
    expect(out.credits[0]).toMatchObject({ rate: 285, balance: 9500 });
    expect(out.credits[0].extras[0].amt).toBe(950);
    expect(out.goals[0]).toMatchObject({ target: 950, saved: 190 });
    expect(out.plans[0].amount).toBe(47.5);
    expect(out.snapshots[0]).toMatchObject({ net: 9500, pf: 4750, debt: 950 });
  });
  it("Posten mit Währungsfeld behalten ihre bisherige Währung", () => {
    const out = convertData(d, "EUR", "CHF", 0.95);
    expect(out.incomes[0].ccy).toBe("CHF");
    expect(out.incomes[1]).toMatchObject({ amount: 800, ccy: "EUR" });
    expect(out.expenses[0]).toMatchObject({ amount: 1200, ccy: "EUR" });
    expect(out.investments[1]).toMatchObject({ price: 2000, ccy: "EUR" });
    setCurrency("CHF");
    expect(monthlyIn(out.expenses[0], { EUR: 1 / 0.95 })).toBeCloseTo(1200 / 0.95);
    expect(fxOf("CHF", {})).toBe(1);
    setCurrency("EUR");
  });
  it("gleiche Währung oder ungültiger Kurs ändert nichts", () => {
    expect(convertData(d, "EUR", "EUR", 1)).toBe(d);
    expect(convertData(d, "EUR", "CHF", 0)).toBe(d);
  });
});
