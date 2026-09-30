import { describe, it, expect } from "vitest";
import { makeValuer, wealthSeries, monthRef, netAtSnapshot, priceOnOrBefore } from "../src/lib/wealth.js";
import { buildGroups } from "../src/lib/finance.js";

describe("Vermögensverlauf", () => {
  const inv = [
    { id: "a", type: "etf", symbol: "SPY", qty: 10, buyPrice: 100, buyDate: "2026-06-01", price: 130 },
    { id: "c", type: "cash", qty: 1, price: 1000, buyPrice: 1000, flows: [{ id: "f", d: "2026-08-15", amt: 400 }] },
  ];
  const groups = buildGroups(inv, [], { EUR: 1, USD: 0.9 });
  const hist = { "td:SPY": { ccy: "USD", series: { "2026-06-30": 110, "2026-07-31": 120, "2026-08-29": 125 } } };
  const valuer = makeValuer({ groups, hist, fxRates: { EUR: 1, USD: 0.9 }, cur: "EUR" });
  it("bewertet einen Stichtag aus Historie und Cash-Flüssen", () => {
    expect(valuer.stockAt("2026-07-31")).toBeCloseTo(10 * 120 * 0.9);
    expect(valuer.stockAt("2026-08-31")).toBeCloseTo(10 * 125 * 0.9); /* letzter Kurs ≤ Stichtag */
    expect(valuer.cashAt("2026-07-31")).toBe(600);
    expect(valuer.cashAt("2026-08-31")).toBe(1000);
    expect(valuer.stockAt("2026-05-31")).toBe(0);
  });
  it("Monatsreihe: laufender Monat live, Vormonate rekonstruiert", () => {
    const s = wealthSeries({ valuer, snapshots: [{ m: "2026-08", debt: 100 }], netWorth: 5000, creditBalance: 0, now: new Date(2026, 8, 20) });
    expect(s.map((x) => x.m)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(s[2].net).toBe(5000);
    expect(s[1].net).toBe(Math.round(10 * 125 * 0.9 + 1000 - 100));
    expect(monthRef("2026-02", "2026-09")).toBe("2026-02-28");
    expect(netAtSnapshot({ valuer, snap: { m: "2026-07", debt: 0 }, netWorth: 1, now: new Date(2026, 8, 20) })).toBeCloseTo(1080 + 600);
    expect(priceOnOrBefore({ "2026-01-01": 1, "2026-01-05": 2 }, "2026-01-04")).toBe(1);
  });
});
