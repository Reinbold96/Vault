import { describe, it, expect } from "vitest";
import { addMonthsIso, planDates, duePlanDates, nextPlanDate, runPlans, repricePlanLots, planStats, makePlan } from "../src/lib/plans.js";
import { gkeyOf } from "../src/lib/finance.js";

describe("Sparplan-Termine", () => {
  it("Monatsende wird gekappt", () => {
    expect(addMonthsIso("2025-01-31", 1)).toBe("2025-02-28");
    expect(addMonthsIso("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsIso("2025-11-15", 3)).toBe("2026-02-15");
  });
  it("fällige und nächste Termine", () => {
    const p = { start: "2025-01-15", interval: "quartalsweise", lastRun: "2025-04-15" };
    expect(planDates(p, "2025-12-31")).toEqual(["2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15"]);
    expect(duePlanDates(p, "2025-12-31")).toEqual(["2025-07-15", "2025-10-15"]);
    expect(nextPlanDate(p, "2025-08-01")).toBe("2025-10-15");
    expect(duePlanDates({ ...p, active: false }, "2025-12-31")).toEqual([]);
    expect(duePlanDates({ ...p, end: "2025-08-01" }, "2025-12-31")).toEqual(["2025-07-15"]);
  });
});

describe("Sparplan ausführen", () => {
  const plan = { ...makePlan({ gkey: "etf:EUNL", tpl: { type: "etf", symbol: "EUNL", name: "MSCI World" }, amount: 101, fee: 1, interval: "monatlich", start: "2025-01-01" }), id: "p1" };
  const d = { investments: [], sells: [], plans: [plan] };
  it("legt je Termin einen Kauf an – Gebühr im Einstand", () => {
    const prices = { "2025-01-01": 100, "2025-02-01": 80, "2025-03-01": 125 };
    const out = runPlans(d, "2025-03-10", (_p, date) => (prices[date] ? { price: prices[date] } : null));
    expect(out.investments).toHaveLength(3);
    expect(out.investments[1]).toMatchObject({ qty: 1.25, buyDate: "2025-02-01", plan: "p1", symbol: "EUNL" });
    expect(out.investments[1].buyPrice).toBeCloseTo(80.8);
    expect(out.plans[0].lastRun).toBe("2025-03-01");
    expect(gkeyOf(out.investments[0])).toBe("etf:EUNL");
    const st = planStats(out.plans[0], out.investments);
    expect(st.runs).toBe(3);
    expect(st.invested).toBeCloseTo(303);
  });
  it("ohne Kurs bleibt der Termin offen", () => {
    const out = runPlans(d, "2025-03-10", (_p, date) => (date === "2025-01-01" ? { price: 100 } : null));
    expect(out.investments).toHaveLength(1);
    expect(out.plans[0].lastRun).toBe("2025-01-01");
    expect(runPlans(out, "2025-03-10", () => null)).toBe(out);
  });
  it("geschätzte Käufe werden mit echter Historie nachgerechnet", () => {
    const est = runPlans(d, "2025-01-05", () => ({ price: 100, est: true }));
    expect(est.investments[0].est).toBe(true);
    const fixed = repricePlanLots(est, () => ({ price: 50 }), gkeyOf);
    expect(fixed.investments[0].est).toBeUndefined();
    expect(fixed.investments[0].qty).toBe(2);
  });
});

import { planPricer } from "../src/lib/plans.js";

describe("Sparplan-Kurse: nur frische Daten gelten als exakt", () => {
  const plan = { id: "p", gkey: "etf:EUNL", tpl: { type: "etf", symbol: "EUNL" }, amount: 100 };
  const day = (iso) => Date.parse(`${iso}T12:00:00Z`);
  const g = (updated) => ({ gkey: "etf:EUNL", type: "etf", price: 110, ref: { symbol: "EUNL", priceUpdated: updated } });
  it("Historie, die nicht bis an den Termin reicht, ergibt eine Schätzung", () => {
    const hist = { "td:EUNL": { ccy: "EUR", series: { "2026-07-31": 50 } } };
    const { priceAt } = planPricer({ groups: [g(day("2026-09-30"))], hist, today: "2026-09-30" });
    expect(priceAt(plan, "2026-08-15")).toEqual({ price: 110, est: true });
    expect(priceAt(plan, "2026-08-03")).toEqual({ price: 50 }); /* Wochenende: 4 Tage Luft */
  });
  it("aktueller Kurs von vor dem Termin ist nur eine Schätzung", () => {
    const { priceAt } = planPricer({ groups: [g(day("2026-09-20"))], hist: {}, today: "2026-09-30" });
    expect(priceAt(plan, "2026-09-29")).toEqual({ price: 110, est: true });
    const fresh = planPricer({ groups: [g(day("2026-09-30"))], hist: {}, today: "2026-09-30" });
    expect(fresh.priceAt(plan, "2026-09-29")).toEqual({ price: 110 });
  });
  it("Fremdwährung mit dem Kurs des Tages", () => {
    const hist = { "td:EUNL": { ccy: "USD", series: { "2026-08-14": 100 } }, "fx:USD:EUR": { series: { "2026-08-14": 0.9 } } };
    const { priceAt } = planPricer({ groups: [g(day("2026-09-30"))], hist, today: "2026-09-30" });
    expect(priceAt(plan, "2026-08-15").price).toBeCloseTo(90);
  });
  it("Nachrechnen nutzt den Betrag der Ausführung, nicht den geänderten Plan", () => {
    const p1 = { ...plan, amount: 200, fee: 0 };
    const d = { plans: [p1], sells: [], investments: [{ id: "l", type: "etf", symbol: "EUNL", plan: "p", est: true, qty: 1, buyPrice: 100, buyDate: "2026-08-01", planAmt: 100 }] };
    const out = repricePlanLots(d, () => ({ price: 50 }), gkeyOf);
    expect(out.investments[0]).toMatchObject({ qty: 2, buyPrice: 50 });
  });
});
