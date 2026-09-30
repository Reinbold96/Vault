import { describe, it, expect } from "vitest";
import { computeSeries, fifoTimeline, posAt, mergeSeries, lastDateOf } from "../src/lib/portfolioSeries.js";
import { fifoAt, buildGroups } from "../src/lib/finance.js";
import { eachDay } from "../src/lib/utils.js";

const lots = [
  { id: "a", type: "etf", symbol: "SPY", qty: 10, buyPrice: 100, buyDate: "2025-01-02", price: 120 },
  { id: "b", type: "etf", symbol: "SPY", qty: 5, buyPrice: 110, buyDate: "2025-01-06", price: 120 },
];
const sells = [{ id: "s", gkey: "etf:SPY", qty: 8, price: 115, date: "2025-01-08" }];

describe("FIFO-Zeitleiste", () => {
  it("liefert an jedem Tag dasselbe wie fifoAt", () => {
    const tl = fifoTimeline(lots, sells);
    for (const d of eachDay("2025-01-01", "2025-01-12")) {
      const a = posAt(tl, d), b = fifoAt(lots, sells, d);
      expect(a.openQty).toBeCloseTo(b.openQty);
      expect(a.openCost).toBeCloseTo(b.openCost);
    }
  });
});

describe("computeSeries", () => {
  const groups = buildGroups(lots, sells, {});
  const series = {};
  for (const d of eachDay("2025-01-01", "2025-01-10")) series[d] = 100 + Number(d.slice(8)); /* 101 … 110 USD */
  const hist = { "td:SPY": { ccy: "USD", series }, "td:QQQ": { ccy: "USD", series } };
  it("rechnet Kurse und Benchmarks in die Anzeigewährung um", () => {
    const fx = { USD: Object.fromEntries(Object.keys(series).map((d) => [d, 0.9])) };
    const { rows } = computeSeries({ eligible: groups, hist, fx, cur: "EUR", start: "2025-01-02", end: "2025-01-10", bms: [{ id: "n", sym: "QQQ" }] });
    const r = rows.find((x) => x.d === "2025-01-06");
    expect(r.value).toBeCloseTo(15 * 106 * 0.9);
    expect(r.bm_n).toBeCloseTo(106 * 0.9);
    /* TWR folgt dem Kurs, nicht den Käufen/Verkäufen */
    const first = rows[0], last = rows[rows.length - 1];
    expect(last.twr / first.twr).toBeCloseTo(110 / 102, 6);
  });
  it("ohne Historie: heutiger Kurs, als Hinweis markiert", () => {
    const { rows, flatNames } = computeSeries({ eligible: groups, hist: {}, cur: "EUR", start: "2025-01-02", end: "2025-01-03" });
    expect(rows[0].value).toBe(10 * 120);
    expect(flatNames.size).toBe(1);
  });
  it("Serien zusammenführen", () => {
    const m = mergeSeries({ "2025-01-01": 1, "2025-01-02": 2 }, { "2025-01-02": 3, "2025-01-03": 4 });
    expect(m).toEqual({ "2025-01-01": 1, "2025-01-02": 3, "2025-01-03": 4 });
    expect(lastDateOf(m)).toBe("2025-01-03");
  });
});
