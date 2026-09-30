import { describe, it, expect } from "vitest";
import { fetchQuotes, applyQuotes, failedIds, quoteMessage } from "../src/lib/prices.js";
import { normPrice, normSeries } from "../src/lib/api.js";

const json = (body, status = 200) => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(body) });
const noSleep = () => Promise.resolve();
const fx = async (from, to) => ({ "USD>EUR": 0.9, "GBP>EUR": 1.2 }[`${from}>${to}`] || 0);

describe("Unterwährungen", () => {
  it("Pence → Pfund", () => {
    expect(normPrice(1234, "GBp")).toEqual({ price: 12.34, ccy: "GBP" });
    expect(normPrice(12.34, "GBP")).toEqual({ price: 12.34, ccy: "GBP" });
    expect(normSeries({ "2025-01-01": 500 }, "GBX")).toEqual({ series: { "2025-01-01": 5 }, ccy: "GBP" });
  });
});

describe("fetchQuotes", () => {
  it("Finnhub für US, Twelve Data für LSE in Pence, CoinGecko für Krypto", async () => {
    const calls = [];
    const fetchImpl = (url) => {
      calls.push(url);
      if (url.includes("finnhub")) return json({ c: 200, dp: 1.5 });
      if (url.includes("twelvedata")) return json({ close: "8000", currency: "GBp", percent_change: "-0.4" });
      if (url.includes("simple/price")) return json({ bitcoin: { eur: 60000, eur_24h_change: 2 } });
      return json({});
    };
    const items = [
      { id: "1", type: "aktie", symbol: "AAPL" },
      { id: "2", type: "etf", symbol: "VUSA", mic: "XLON" },
      { id: "3", type: "krypto", symbol: "BTC" },
      { id: "4", type: "cash", price: 100 },
    ];
    const r = await fetchQuotes(items, { cur: "EUR", finnhubKey: "k", tdKey: "t", fetchImpl, sleep: noSleep, fx });
    expect(r.bySym.AAPL).toMatchObject({ price: 180, dayPct: 1.5, ccy: "USD" });
    expect(r.bySym.VUSA.price).toBeCloseTo(96); /* 80 GBP × 1,2 */
    expect(r.bySym.VUSA.ccy).toBe("GBP");
    expect(r.bySym.BTC.price).toBe(60000);
    expect(calls.filter((u) => u.includes("frankfurter")).length).toBe(0);
    const applied = applyQuotes(items, r, 1000);
    expect(applied[1]).toMatchObject({ price: 96, qccy: "GBP", priceUpdated: 1000 });
    expect(applied[3]).toBe(items[3]);
    expect(failedIds(items.filter((i) => i.type !== "cash"), r)).toEqual([]);
  });
  it("meldet fehlenden Twelve-Data-Key für EU-Notierungen", async () => {
    const items = [{ id: "1", type: "etf", symbol: "EUNL", mic: "XETR" }];
    const r = await fetchQuotes(items, { cur: "EUR", finnhubKey: "k", fetchImpl: () => json({}), sleep: noSleep, fx });
    expect(r.notes.join(" ")).toMatch(/Twelve-Data-Key/);
    const msg = quoteMessage({ items, res: r, manual: true, lastUpdate: 0 });
    expect(msg).toMatch(/nicht aktualisiert/);
  });
  it("automatischer Abruf ohne Probleme bleibt still", async () => {
    const items = [{ id: "3", type: "krypto", symbol: "BTC" }];
    const r = await fetchQuotes(items, { cur: "EUR", fetchImpl: () => json({ bitcoin: { eur: 1 } }), sleep: noSleep, fx });
    expect(quoteMessage({ items, res: r, manual: false })).toBe("");
  });
});
