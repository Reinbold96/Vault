import { describe, it, expect } from "vitest";
import { buildGroups, monthly, monthlyIn, costBreakdown } from "../src/lib/finance.js";
import { isClosed, tradeStats, perfSummary, holdLabel, sparerPauschbetrag } from "../src/lib/performance.js";
import { parseBackup } from "../src/lib/storage.js";

const fx = { EUR: 1, USD: 0.9, CHF: 1.07 };
const inv = [
  { id: "n1", type: "aktie", symbol: "NVDA", name: "NVIDIA", qty: 10, buyPrice: 120, buyDate: "2025-06-14", price: 181, priceUpdated: Date.parse("2026-09-28T10:00:00Z") },
  { id: "n2", type: "aktie", symbol: "NVDA", name: "NVIDIA", qty: 10, buyPrice: 80, buyDate: "2025-09-02", price: 181 },
  { id: "w1", type: "etf", symbol: "IWDA", name: "MSCI World", qty: 42, buyPrice: 78.5, buyDate: "2025-06-10", price: 97.64 },
  { id: "b1", type: "krypto", symbol: "BTC", name: "Bitcoin", qty: 0.1, buyPrice: 50000, buyDate: "2025-01-10", price: 60000 },
  { id: "c1", type: "cash", name: "Cash EUR", qty: 1, price: 5000, buyPrice: 5000 },
];
const sells = [
  { id: "s1", gkey: "aktie:NVDA", qty: 20, price: 148, date: "2026-05-12" },
  { id: "s2", gkey: "krypto:BTC", qty: 0.1, price: 70000, date: "2025-11-20" },
];
const divs = [
  { id: "d1", gkey: "etf:IWDA", amt: 62, date: "2026-03-15" },
  { id: "d2", gkey: "etf:IWDA", amt: 34, date: "2025-12-01" },
];
const groups = buildGroups(inv, sells, fx);
const g = (k) => groups.find((x) => x.gkey === k);

describe("Intervalle und Währung", () => {
  it("rechnet quartalsweise, halbjährlich und jährlich auf den Monat um", () => {
    expect(monthly({ amount: 90, interval: "quartalsweise" })).toBe(30);
    expect(monthly({ amount: 120, interval: "halbjaehrlich" })).toBe(20);
    expect(monthly({ amount: 120, interval: "jaehrlich" })).toBe(10);
    expect(monthly({ amount: 50 })).toBe(50);
  });
  it("rechnet Posten in Fremdwährung in die Anzeigewährung um", () => {
    expect(monthlyIn({ amount: 300, interval: "monatlich", ccy: "CHF" }, fx)).toBeCloseTo(321);
    expect(monthlyIn({ amount: 300, interval: "monatlich" }, fx)).toBe(300);
    const c = costBreakdown([{ kind: "fix", amount: 1200, interval: "jaehrlich", ccy: "CHF" }], [], fx);
    expect(c.fixTotal).toBeCloseTo(107);
  });
  it("Backup behält Intervall und Währung, ignoriert Unsinn", () => {
    const r = parseBackup(JSON.stringify({
      incomes: [{ name: "Lohn", amount: 8000, ccy: "CHF" }, { name: "X", amount: 1, ccy: "JPY" }],
      expenses: [{ name: "KK", amount: 400, interval: "quartalsweise", ccy: "CHF" }, { name: "Y", amount: 1, interval: "woechentlich" }],
      archived: ["aktie:NVDA", 5],
    }));
    expect(r.data.incomes[0].ccy).toBe("CHF");
    expect(r.data.incomes[1].ccy).toBeUndefined();
    expect(r.data.expenses[0]).toMatchObject({ interval: "quartalsweise", ccy: "CHF" });
    expect(r.data.expenses[1].interval).toBe("monatlich");
    expect(r.data.archived).toEqual(["aktie:NVDA"]);
  });
});

describe("Verkaufte Positionen", () => {
  it("erkennt abgeschlossene Positionen", () => {
    expect(isClosed(g("aktie:NVDA"))).toBe(true);
    expect(isClosed(g("krypto:BTC"))).toBe(true);
    expect(isClosed(g("etf:IWDA"))).toBe(false);
    expect(isClosed(g(groups.find((x) => x.type === "cash").gkey))).toBe(false);
  });
  it("Trade-Kennzahlen: Einstand, Erlös, Rendite, Haltedauer, Seit Verkauf", () => {
    const st = tradeStats(g("aktie:NVDA"), divs);
    expect(st.cost).toBe(2000);
    expect(st.proceeds).toBe(2960);
    expect(st.realized).toBe(960);
    expect(st.pct).toBeCloseTo(48);
    expect(st.firstBuy).toBe("2025-06-14");
    expect(st.lastSell).toBe("2026-05-12");
    expect(st.holdDays).toBe(332);
    expect(st.pa).toBeGreaterThan(48);
    expect(st.since.ifHeld).toBeCloseTo(20 * (181 - 148));
    expect(st.since.pct).toBeCloseTo((181 / 148 - 1) * 100);
  });
  it("ohne frischen Kurs kein Seit-Verkauf-Vergleich", () => {
    expect(tradeStats(g("krypto:BTC"), divs).since).toBeNull();
  });
  it("Bilanz: offen + realisiert + Ausschüttungen, je Jahr und steuerrelevant", () => {
    const s = perfSummary(groups, divs);
    expect(s.realized).toBeCloseTo(960 + 2000);
    expect(s.divTotal).toBe(96);
    expect(s.unreal).toBeCloseTo(42 * (97.64 - 78.5));
    expect(s.total).toBeCloseTo(s.unreal + s.realized + s.divTotal);
    expect(s.byYear["2026"]).toMatchObject({ realized: 960, taxable: 960, divs: 62 });
    /* Krypto-Gewinn 2025 zählt realisiert, aber nicht zum Pauschbetrag */
    expect(s.byYear["2025"].realized).toBeCloseTo(2000);
    expect(s.byYear["2025"].taxable).toBe(0);
    expect(s.contributors[0].gkey).toBe("krypto:BTC");
    expect(s.contributors.find((c) => c.gkey === "aktie:NVDA").closed).toBe(true);
    expect(s.contributors.some((c) => c.type === "cash")).toBe(false);
  });
  it("Hilfen", () => {
    expect(holdLabel(12)).toBe("12 Tage");
    expect(holdLabel(332)).toBe("11 Mon.");
    expect(holdLabel(900)).toBe("2,5 J.");
    expect(sparerPauschbetrag(false)).toBe(1000);
    expect(sparerPauschbetrag(true)).toBe(2000);
  });
});
