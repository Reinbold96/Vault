import { describe, it, expect } from "vitest";
import { allocation, regionOf, etfRegionFromName, tradeCcyOf, weightOf } from "../src/lib/allocation.js";

const g = (o) => ({ lots: [], ref: {}, ...o });

describe("Aufteilung", () => {
  const groups = [
    g({ gkey: "aktie:AAPL", type: "aktie", name: "Apple", value: 400, ref: { isin: "US0378331005", qccy: "USD" } }),
    g({ gkey: "etf:EUNL", type: "etf", name: "iShares Core MSCI World", value: 500, ref: { mic: "XETR" } }),
    g({ gkey: "etf:EMIM", type: "etf", name: "iShares Core MSCI EM IMI", value: 100, ref: {} }),
    g({ gkey: "krypto:BTC", type: "krypto", name: "Bitcoin", value: 200, ref: {} }),
    g({ gkey: "cash:1", type: "cash", name: "Cash", value: 300, ref: { ccy: "CHF" } }),
    g({ gkey: "aktie:ZZ", type: "aktie", name: "Unbekannt AG", value: 0, ref: {} }),
  ];
  it("nach Art: fester Slot, Liste nach Grösse", () => {
    const a = allocation(groups, "type");
    expect(a.total).toBe(1500);
    expect(a.bar.map((x) => x.id)).toEqual(["aktie", "etf", "krypto", "cash"]);
    expect(a.rows[0]).toMatchObject({ id: "etf", value: 600 });
    expect(a.rows[0].pct).toBeCloseTo(40);
  });
  it("nach Währung", () => {
    const a = allocation(groups, "ccy", { cur: "EUR" });
    const by = Object.fromEntries(a.rows.map((r) => [r.id, r.value]));
    expect(by).toMatchObject({ USD: 400, EUR: 500, Krypto: 200, CHF: 300, "?": 100 });
  });
  it("nach Region: nur Aktien und ETFs", () => {
    const a = allocation(groups, "region");
    const by = Object.fromEntries(a.rows.map((r) => [r.id, r.value]));
    expect(by).toMatchObject({ na: 400, world: 500, em: 100 });
    expect(a.excluded).toBe(2);
  });
  it("eigene Region schlägt die Automatik", () => {
    expect(regionOf(g({ type: "etf", name: "MSCI World", ref: { region: "eu" } }))).toEqual({ id: "eu", auto: false });
    expect(etfRegionFromName("Vanguard FTSE All-World")).toBe("world");
    expect(etfRegionFromName("iShares Core S&P 500")).toBe("na");
    expect(etfRegionFromName("Xtrackers Euro Stoxx 50")).toBe("eu");
    expect(etfRegionFromName("Amundi MSCI Emerging Markets")).toBe("em");
  });
  it("Handelswährung aus Historie oder Börse", () => {
    expect(tradeCcyOf(g({ type: "etf", ref: { symbol: "VUSA" } }), { hist: { "td:VUSA": { ccy: "GBP" } } })).toBe("GBP");
    expect(tradeCcyOf(g({ type: "aktie", ref: { mic: "XSWX" } }))).toBe("CHF");
    expect(weightOf({ value: 25 }, 200)).toBe(12.5);
  });
});
