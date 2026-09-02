import { describe, it, expect } from "vitest";
import { estGrundtarif2026, einkommensteuer2026, soli2026, TARIF_2026, KINDERFREIBETRAG, objektAnalyse } from "../src/lib/tax.js";

describe("Einkommensteuertarif 2026 (§ 32a EStG)", () => {
  it("ist an allen Zonengrenzen stetig (Sprung < 2 €)", () => {
    for (const b of [TARIF_2026.grundfreibetrag, TARIF_2026.zone1Ende, TARIF_2026.zone2Ende, TARIF_2026.zone3Ende]) {
      expect(Math.abs(estGrundtarif2026(b + 1) - estGrundtarif2026(b))).toBeLessThan(2);
    }
  });
  it("ist monoton steigend", () => {
    let prev = 0;
    for (let x = 0; x <= 400000; x += 137) { const v = estGrundtarif2026(x); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });
  it("Grundfreibetrag ist steuerfrei, Spitzensteuersatz greift", () => {
    expect(estGrundtarif2026(12348)).toBe(0);
    expect(estGrundtarif2026(300000)).toBe(Math.floor(0.45 * 300000 - 19470.38));
  });
  it("Splitting verdoppelt den halben Tarif", () => {
    expect(einkommensteuer2026(80000, true)).toBe(2 * estGrundtarif2026(40000));
  });
  it("Soli: Freigrenze und Milderungszone 2026", () => {
    expect(soli2026(20350, false)).toBe(0);
    expect(soli2026(20351, false)).toBeCloseTo(0.119, 3);
    expect(soli2026(100000, false)).toBeCloseTo(5500, 5);
    expect(soli2026(40700, true)).toBe(0);
  });
  it("Kinderfreibetrag 2026 inkl. BEA", () => { expect(KINDERFREIBETRAG).toBe(9756); });
});

describe("objektAnalyse", () => {
  const base = { price: "300000", state: "by", rent: "1000", equity: "60000", zins: "3.5", tilgung: "2" };
  it("rechnet Nebenkosten aus dem Bundesland", () => {
    const a = objektAnalyse(base, {});
    expect(a.grestPct).toBe(3.5);
    expect(a.nk).toBeCloseTo(300000 * 0.055, 2);
  });
  it("Annahmen wirken: Mietsteigerung erhöht kumulierten Cashflow", () => {
    const a0 = objektAnalyse({ ...base, horizon: "10" }, {});
    const a1 = objektAnalyse({ ...base, horizon: "10", rentGrowth: "2" }, {});
    expect(a1.rows[9].kum).toBeGreaterThan(a0.rows[9].kum);
    const a2 = objektAnalyse({ ...base, horizon: "10", propGrowth: "2" }, {});
    expect(a2.rows[9].wert).toBeGreaterThan(a0.rows[9].wert);
  });
});
