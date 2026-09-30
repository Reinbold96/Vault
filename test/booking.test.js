import { describe, it, expect } from "vitest";
import { bookSell, updateSell, removeSell, bookDiv, removeDiv, bookExtra, removeExtra, bookCashFlow, removeCashFlow, savePosition, removeGroup } from "../src/lib/booking.js";
import { buildGroups } from "../src/lib/finance.js";

const base = () => ({
  investments: [
    { id: "a1", type: "aktie", symbol: "AAPL", name: "Apple", qty: 10, buyPrice: 100, price: 150, buyDate: "2024-01-02" },
    { id: "a2", type: "aktie", symbol: "AAPL", name: "Apple", qty: 5, buyPrice: 120, price: 150, buyDate: "2024-06-02" },
  ],
  sells: [], divs: [], credits: [{ id: "k", name: "Auto", rate: 300, balance: 5000 }], plans: [], archived: [],
});

describe("Verkäufe", () => {
  it("bucht den Erlös auf ein neues Cash-Konto", () => {
    const d = bookSell(base(), "aktie:AAPL", { qty: 4, price: 200, date: "2025-01-10" }, { cur: "EUR", id: "s1" });
    const cash = d.investments.find((x) => x.type === "cash");
    expect(cash.price).toBe(800);
    expect(cash.flows[0]).toMatchObject({ id: "s1", amt: 800 });
    expect(d.sells).toHaveLength(1);
  });
  it("Bearbeiten passt Verkauf und Cash-Buchung an", () => {
    let d = bookSell(base(), "aktie:AAPL", { qty: 4, price: 200, date: "2025-01-10" }, { cur: "EUR", id: "s1" });
    d = updateSell(d, "s1", { qty: 5, price: 210, date: "2025-01-11" });
    const cash = d.investments.find((x) => x.type === "cash");
    expect(d.sells[0]).toMatchObject({ qty: 5, price: 210, date: "2025-01-11" });
    expect(cash.price).toBe(1050);
    expect(cash.flows[0]).toMatchObject({ amt: 1050, d: "2025-01-11" });
  });
  it("Löschen rechnet den Erlös wieder heraus", () => {
    let d = bookSell(base(), "aktie:AAPL", { qty: 4, price: 200, date: "2025-01-10" }, { cur: "EUR", id: "s1" });
    d = removeSell(d, "s1");
    expect(d.sells).toHaveLength(0);
    expect(d.investments.find((x) => x.type === "cash").price).toBe(0);
  });
});

describe("Ausschüttungen", () => {
  it("speichert einbehaltene Steuer und bucht netto aufs Cash-Konto", () => {
    const d = bookDiv(base(), "aktie:AAPL", { amt: 73.6, tax: 26.4, date: "2025-03-01", toCash: true }, { cur: "EUR", id: "d1" });
    expect(d.divs[0]).toMatchObject({ amt: 73.6, tax: 26.4 });
    expect(d.investments.find((x) => x.type === "cash").price).toBeCloseTo(73.6);
    const back = removeDiv(d, "d1");
    expect(back.divs).toHaveLength(0);
    expect(back.investments.find((x) => x.type === "cash").price).toBeCloseTo(0);
  });
  it("ohne Steuer kein tax-Feld", () => {
    const d = bookDiv(base(), "aktie:AAPL", { amt: 10, date: "2025-03-01" }, { cur: "EUR" });
    expect("tax" in d.divs[0]).toBe(false);
  });
});

describe("Cash und Sondertilgung", () => {
  it("Sondertilgung vom Cash-Konto und zurück", () => {
    let d = bookSell(base(), "aktie:AAPL", { qty: 5, price: 200, date: "2025-01-10" }, { cur: "EUR", id: "s1" });
    d = bookExtra(d, "k", { amt: 400, date: "2025-02-01", fromCash: true }, { cur: "EUR", id: "x1" });
    expect(d.credits[0].balance).toBe(4600);
    expect(d.investments.find((x) => x.type === "cash").price).toBe(600);
    d = removeExtra(d, "k", "x1");
    expect(d.credits[0].balance).toBe(5000);
    expect(d.investments.find((x) => x.type === "cash").price).toBe(1000);
  });
  it("Auszahlung wird nie negativ", () => {
    let d = bookSell(base(), "aktie:AAPL", { qty: 1, price: 100, date: "2025-01-10" }, { cur: "EUR" });
    const cashId = d.investments.find((x) => x.type === "cash").id;
    d = bookCashFlow(d, cashId, -500, "2025-02-01", "Auszahlung", "f1");
    expect(d.investments.find((x) => x.type === "cash").price).toBe(0);
    d = removeCashFlow(d, cashId, "f1");
    expect(d.investments.find((x) => x.type === "cash").price).toBe(500);
  });
});

describe("Position bearbeiten", () => {
  it("Ticker → WKN: neue Kennung auf allen Käufen, Verkäufe ziehen mit", () => {
    let d = bookSell(base(), "aktie:AAPL", { qty: 2, price: 200, date: "2025-01-10" }, { cur: "EUR", id: "s1" });
    d = { ...d, divs: [{ id: "d", gkey: "aktie:AAPL", amt: 5, date: "2025-02-01" }], archived: ["aktie:AAPL"], plans: [{ id: "p", gkey: "aktie:AAPL", tpl: { type: "aktie", symbol: "AAPL" }, amount: 50, interval: "monatlich", start: "2025-01-01" }] };
    const r = savePosition(d, "aktie:AAPL", { symbol: "APC", isin: "US0378331005", wkn: "865985", idType: "wkn", mic: "XETR", exchange: "Xetra", name: "Apple Inc." });
    expect(r.gkey).toBe("aktie:APC");
    const lots = r.data.investments.filter((x) => x.type === "aktie");
    expect(lots.every((l) => l.symbol === "APC" && l.wkn === "865985" && l.name === "Apple Inc." && l.priceUpdated === 0)).toBe(true);
    expect(r.data.sells[0].gkey).toBe("aktie:APC");
    expect(r.data.divs[0].gkey).toBe("aktie:APC");
    expect(r.data.archived).toEqual(["aktie:APC"]);
    expect(r.data.plans[0]).toMatchObject({ gkey: "aktie:APC", tpl: { symbol: "APC", wkn: "865985" } });
    const g = buildGroups(r.data.investments, r.data.sells, {}).find((x) => x.gkey === "aktie:APC");
    expect(g.qty).toBe(13);
  });
  it("zurück auf Ticker entfernt ISIN/WKN", () => {
    const d0 = base();
    d0.investments = d0.investments.map((x) => ({ ...x, isin: "US0378331005", idType: "isin" }));
    const r = savePosition(d0, "aktie:AAPL", { symbol: "AAPL", isin: "", wkn: "", idType: "", mic: "", exchange: "" });
    expect(r.gkey).toBe("aktie:AAPL");
    expect(r.data.investments.every((l) => !l.isin && !l.idType)).toBe(true);
  });
  it("Position löschen entfernt auch den Sparplan", () => {
    const d = { ...base(), plans: [{ id: "p", gkey: "aktie:AAPL" }] };
    expect(removeGroup(d, "aktie:AAPL").plans).toHaveLength(0);
  });
});

describe("Verkauf bearbeiten nach Währungswechsel", () => {
  it("skaliert die Cash-Buchung in ihrer eigenen Währung", () => {
    const d = {
      investments: [{ id: "c", type: "cash", ccy: "EUR", qty: 1, price: 1000, buyPrice: 1000, flows: [{ id: "s1", d: "2025-01-01", amt: 1000 }] }],
      sells: [{ id: "s1", gkey: "aktie:X", qty: 10, price: 94, date: "2025-01-01" }], /* in CHF umgerechnet */
    };
    const out = updateSell(d, "s1", { qty: 10, price: 94, date: "2025-01-02" });
    expect(out.investments[0].price).toBe(1000); /* nur das Datum geändert: Betrag bleibt */
    const out2 = updateSell(d, "s1", { qty: 5, price: 94, date: "2025-01-02" });
    expect(out2.investments[0].price).toBe(500);
  });
});
