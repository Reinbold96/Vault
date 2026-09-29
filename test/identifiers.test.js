import { describe, it, expect } from "vitest";
import {
  isValidIsin, isValidWkn, isinCheckDigit, wknToDeIsin, detectIdType, idProblem,
  rankListings, tidyName, resolveSecurity, isUsMic,
} from "../src/lib/identifiers.js";
import { parseBackup } from "../src/lib/storage.js";

describe("ISIN und WKN prüfen", () => {
  it("erkennt gültige ISINs an der Prüfziffer", () => {
    expect(isValidIsin("US0378331005")).toBe(true); /* Apple */
    expect(isValidIsin("DE0007164600")).toBe(true); /* SAP */
    expect(isValidIsin("IE00B4L5Y983")).toBe(true); /* MSCI World */
    expect(isValidIsin("US8629453007")).toBe(true); /* Strive (ASST) */
    expect(isValidIsin("us0378331005")).toBe(true);
    expect(isValidIsin("US0378331006")).toBe(false);
    expect(isValidIsin("US037833100")).toBe(false);
    expect(isinCheckDigit("DE000716460")).toBe(0);
  });
  it("WKN: 6 Zeichen ohne I und O, deutsche WKN → ISIN", () => {
    expect(isValidWkn("865985")).toBe(true);
    expect(isValidWkn("A41U5B")).toBe(true);
    expect(isValidWkn("A0RPWI")).toBe(false);
    expect(isValidWkn("12345")).toBe(false);
    expect(wknToDeIsin("716460")).toBe("DE0007164600");
    expect(wknToDeIsin("BASF11")).toBe("DE000BASF111");
  });
  it("erkennt die Art der Eingabe und meldet Tippfehler erst bei voller Länge", () => {
    expect(detectIdType("US8629453007")).toBe("isin");
    expect(detectIdType("A41U5B")).toBe("wkn");
    expect(detectIdType("ASST")).toBe("ticker");
    expect(detectIdType("NVDA")).toBe("ticker");
    expect(idProblem("isin", "US86")).toBeNull();
    expect(idProblem("isin", "US8629453008")).toMatch(/Prüfziffer/);
    expect(idProblem("wkn", "A0RPWI")).toMatch(/ohne I und O/);
  });
});

describe("Handelsplätze und Suche", () => {
  const td = [
    { symbol: "SWDA", exchange: "LSE", mic_code: "XLON", currency: "GBp" },
    { symbol: "EUNL", exchange: "XETR", mic_code: "XETR", currency: "EUR" },
    { symbol: "IRRRF", exchange: "OTC", mic_code: "PSGM", currency: "USD" },
    { symbol: "EUNL", exchange: "XETR", mic_code: "XETR", currency: "EUR" },
  ];
  it("sortiert US-Börsen und Anzeigewährung nach vorn, OTC nach hinten, ohne Doppelte", () => {
    const r = rankListings(td, "", "EUR");
    expect(r.map((x) => x.symbol)).toEqual(["EUNL", "SWDA", "IRRRF"]);
    const us = rankListings([{ symbol: "AAPL", exchange: "BVC", mic_code: "XBOG", currency: "COP" }, { symbol: "AAPL", exchange: "NASDAQ", mic_code: "XNGS", currency: "USD" }], "AAPL");
    expect(us[0].mic).toBe("XNGS");
    expect(isUsMic("XNGS")).toBe(true);
    expect(isUsMic("XETR")).toBe(false);
    expect(isUsMic("")).toBe(true);
  });
  it("kürzt lange Namen", () => {
    expect(tidyName("Strive, Inc. Class A Common Stock")).toBe("Strive, Inc.");
    expect(tidyName("Apple Inc.")).toBe("Apple Inc.");
  });

  const mockFetch = (routes) => async (url) => {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) throw new Error("offline");
    return { ok: true, json: async () => hit[1] };
  };
  it("WKN → onvista (ISIN, Heimat-Ticker) → Twelve Data (Börsen)", async () => {
    const f = mockFetch({
      "api.onvista.de": { list: [{ entityType: "STOCK", name: "ASSET ENTITIES INC. CL.B", isin: "US8629453007", wkn: "A41U5B", symbol: "1OQ0", homeSymbol: "ASST" }] },
      "symbol_search?symbol=US8629453007": { data: [
        { symbol: "ASST", instrument_name: "Strive, Inc. Class A Common Stock", exchange: "NASDAQ", mic_code: "XNCM", currency: "USD", instrument_type: "Common Stock" },
      ] },
    });
    const r = await resolveSecurity("wkn", "a41u5b", { fetchImpl: f });
    expect(r).toMatchObject({ name: "Strive, Inc.", type: "aktie", isin: "US8629453007", wkn: "A41U5B" });
    expect(r.pick).toMatchObject({ symbol: "ASST", mic: "XNCM" });
  });
  it("ohne onvista: deutsche WKN über DE000-ISIN, ETF wird erkannt", async () => {
    const f = mockFetch({
      "symbol_search?symbol=DE0007164600": { data: [{ symbol: "SAP", instrument_name: "SAP SE", exchange: "XETR", mic_code: "XETR", currency: "EUR", instrument_type: "Common Stock" }] },
    });
    const r = await resolveSecurity("wkn", "716460", { fetchImpl: f });
    expect(r).toMatchObject({ isin: "DE0007164600", wkn: "716460", type: "aktie" });
    expect(r.pick.symbol).toBe("SAP");
    const etf = await resolveSecurity("isin", "IE00B4L5Y983", { fetchImpl: mockFetch({
      "api.onvista.de": { list: [{ entityType: "FUND", name: "iShares Core MSCI World UCITS ETF USD Acc.", isin: "IE00B4L5Y983", wkn: "A0RPWH", symbol: "EUNL" }] },
      "symbol_search": { data: [{ symbol: "EUNL", exchange: "XETR", mic_code: "XETR", currency: "EUR", instrument_type: "ETF", instrument_name: "iShares Core MSCI World UCITS ETF USD (Acc)" }] },
    }) });
    expect(etf).toMatchObject({ type: "etf", wkn: "A0RPWH" });
  });
  it("nichts gefunden oder ungültig → null, Netzfehler werfen nicht", async () => {
    expect(await resolveSecurity("isin", "US0378331006", { fetchImpl: mockFetch({}) })).toBeNull();
    expect(await resolveSecurity("isin", "US0378331005", { fetchImpl: mockFetch({}) })).toBeNull();
  });
});

describe("Backup behält Kennungen", () => {
  it("übernimmt gültige ISIN/WKN/Börse und verwirft Unsinn", () => {
    const r = parseBackup(JSON.stringify({
      investments: [
        { symbol: "ASST", type: "aktie", qty: 5, isin: "US8629453007", wkn: "A41U5B", idType: "wkn", mic: "XNCM", exchange: "NASDAQ" },
        { symbol: "X", type: "aktie", qty: 1, isin: "US0000000001", wkn: "IOIOIO", idType: "foo", mic: "x" },
      ],
    }));
    expect(r.data.investments[0]).toMatchObject({ isin: "US8629453007", wkn: "A41U5B", idType: "wkn", mic: "XNCM", exchange: "NASDAQ" });
    const b = r.data.investments[1];
    expect(b.isin).toBeUndefined();
    expect(b.wkn).toBeUndefined();
    expect(b.idType).toBeUndefined();
    expect(b.mic).toBeUndefined();
  });
});
