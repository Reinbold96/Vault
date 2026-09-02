import { describe, it, expect } from "vitest";
import { fifo, payoffPlan, amortSchedule, applyDueCredits, propValueAt, buildGroups } from "../src/lib/finance.js";

describe("fifo", () => {
  const lots = [
    { id: "a", qty: 10, buyPrice: 100, buyDate: "2024-01-01" },
    { id: "b", qty: 10, buyPrice: 200, buyDate: "2024-06-01" },
  ];
  it("verkauft die ältesten Käufe zuerst", () => {
    const r = fifo(lots, [{ id: "s", qty: 15, price: 300, date: "2024-12-01" }]);
    expect(r.openQty).toBe(5);
    expect(r.openCost).toBe(5 * 200);
    expect(r.realized).toBe(10 * 200 + 5 * 100); // (300-100)*10 + (300-200)*5
  });
  it("ohne Verkäufe bleibt alles offen", () => {
    const r = fifo(lots, []);
    expect(r.openQty).toBe(20); expect(r.realized).toBe(0);
  });
});

describe("payoffPlan / amortSchedule", () => {
  it("tilgt einen Kredit vollständig", () => {
    const p = payoffPlan(10000, 500, 5);
    expect(p.ok).toBe(true); expect(p.months).toBeGreaterThan(20); expect(p.months).toBeLessThan(24);
  });
  it("erkennt nicht tilgbare Kredite", () => { expect(payoffPlan(100000, 100, 5).ok).toBe(false); });
  it("Tilgungsplan endet bei 0 und summiert Zinsen", () => {
    const s = amortSchedule({ rate: 500, balance: 10000, interest: 5 });
    expect(s.paidOff).toBe(true); expect(s.rows.at(-1).bal).toBe(0); expect(s.totalInterest).toBeGreaterThan(0);
  });
});

describe("applyDueCredits", () => {
  it("initialisiert lastAppliedIdx ohne zu buchen", () => {
    const d = applyDueCredits({ credits: [{ id: "c", rate: 100, balance: 1000, interest: 0, paymentDay: 1 }] });
    expect(d.credits[0].balance).toBe(1000);
    expect(typeof d.credits[0].lastAppliedIdx).toBe("number");
  });
  it("bucht fällige Monate nach", () => {
    const now = new Date();
    const idx = now.getFullYear() * 12 + now.getMonth();
    const d = applyDueCredits({ credits: [{ id: "c", rate: 100, balance: 1000, interest: 0, paymentDay: 1, lastAppliedIdx: idx - 3 }] });
    expect(d.credits[0].balance).toBe(700);
  });
  it("Zahltag 31 wird in kurzen Monaten auf den Monatsletzten gezogen", () => {
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const d = applyDueCredits({ credits: [{ id: "c", rate: 100, balance: 1000, interest: 0, paymentDay: 31 }] });
    const expectIdx = now.getFullYear() * 12 + now.getMonth() - (now.getDate() < Math.min(31, dim) ? 1 : 0);
    expect(d.credits[0].lastAppliedIdx).toBe(expectIdx);
  });
});

describe("propValueAt", () => {
  it("Rate: wächst exponentiell ab Kauf", () => {
    const v = propValueAt({ buyPrice: 100000, buyDate: "2020-01-01", valMode: "rate", growth: 2 }, "2030-01-01");
    expect(v).toBeCloseTo(100000 * Math.pow(1.02, 10), -2);
  });
});

describe("buildGroups", () => {
  it("fasst Käufe eines Symbols zusammen und rechnet Cash in Anzeigewährung", () => {
    const g = buildGroups([
      { id: "1", type: "aktie", symbol: "AAPL", name: "Apple", qty: 5, buyPrice: 100, price: 150 },
      { id: "2", type: "aktie", symbol: "aapl", name: "Apple", qty: 5, buyPrice: 120, price: 150 },
      { id: "3", type: "cash", name: "USD", ccy: "USD", qty: 1, price: 1000 },
    ], [], { EUR: 1, USD: 0.9, CHF: 1 });
    const apple = g.find((x) => x.type === "aktie");
    expect(g).toHaveLength(2); expect(apple.qty).toBe(10); expect(apple.value).toBe(1500); expect(apple.cost).toBe(1100);
    expect(g.find((x) => x.type === "cash").value).toBe(900);
  });
});
