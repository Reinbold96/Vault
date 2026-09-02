import { describe, it, expect } from "vitest";
import { parseAmount, roundPrice, fmtQty } from "../src/lib/currency.js";

describe("parseAmount", () => {
  it.each([
    ["0.123", "0.123"], ["0,123", "0.123"], ["1.250", "1250"], ["1.250,50", "1250.50"], ["1.250.000", "1250000"],
    ["2.5", "2.5"], ["12.34", "12.34"], ["1500", "1500"], ["-3,2", "-3.2"], ["", ""], ["-", ""], ["abc", ""],
    ["1 234,56 €", "1234.56"],
  ])("%s → %s", (input, expected) => { expect(parseAmount(input)).toBe(expected); });
});

describe("roundPrice", () => {
  it("behält Micro-Cap-Kurse", () => { expect(roundPrice(0.00001234)).toBe(0.00001234); });
  it("rundet grosse Kurse sinnvoll", () => { expect(roundPrice(190.12345678)).toBe(190.12346); });
});

describe("fmtQty", () => {
  it("formatiert kompakt", () => { expect(fmtQty(42)).toBe("42"); expect(fmtQty(0.11)).toBe("0,11"); expect(fmtQty(1.5)).toBe("1,5"); });
});
