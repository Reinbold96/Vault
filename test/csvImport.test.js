import { describe, it, expect } from "vitest";
import { readCsv, toTxns, planImport, applyImport, parseNum, parseDate, classify, detectDecimal } from "../src/lib/csvImport.js";
import { buildGroups } from "../src/lib/finance.js";

const SCALABLE = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency
2024-10-23;13:10:35;Executed;"SCALHGJwmX8Bo9W";"Uranium Energy Co";Security;Buy;US9168961038;80;7,34;-587,20;0,00;0,00;EUR
2024-10-22;16:04:22;Executed;"SCALNAy7S3rcUkQ";"Uranium Energy Co";Security;Sell;US9168961038;20;7,34;146,80;1,00;12,23;EUR
2024-11-01;08:00:00;Executed;"SCALabc";"iShares Core MSCI World UCITS ETF";Security;Savings plan;IE00B4L5Y983;1,234567;81,00;-100,00;0,00;0,00;EUR
2024-12-10;09:00:00;Executed;"SCALdiv";"iShares Core MSCI World UCITS ETF";Security;Distribution;IE00B4L5Y983;;;7,36;0,00;2,64;EUR
2024-12-11;09:00:00;Executed;"SCALdep";"Einzahlung";Cash;Deposit;;;;1.000,00;0,00;0,00;EUR
2024-12-12;09:00:00;Cancelled;"SCALx";"Uranium Energy Co";Security;Buy;US9168961038;10;7,00;-70,00;0,00;0,00;EUR
`;

const TR = `"datetime","date","account_type","category","type","asset_class","name","symbol","shares","price","amount","fee","tax","currency","description","transaction_id"
"2025-01-15T09:01:02.000Z","2025-01-15","DEFAULT","TRADING","BUY","STOCK","Apple","US0378331005","2","200.00","-401.00","-1.00","","EUR","Kauf","t1"
"2025-02-01T09:00:00.000Z","2025-02-01","DEFAULT","TRADING","BUY","CRYPTO","Bitcoin","XF000BTC0017","0.001","50000","-50.00","","","EUR","Sparplan","t2"
"2025-03-01T09:00:00.000Z","2025-03-01","DEFAULT","CASH","INTEREST_PAYMENT","","","","","","3.10","","","EUR","Zinsen","t3"
"2025-03-10T09:00:00.000Z","2025-03-10","DEFAULT","TRADING","BUY_CANCELLED","STOCK","Apple","US0378331005","2","200.00","401.00","","","EUR","Storno","t4"
`;

describe("Zahlen, Daten, Typen", () => {
  it("parst deutsche und englische Zahlen", () => {
    expect(parseNum("1.526,72", ",")).toBe(1526.72);
    expect(parseNum("-587,20", ",")).toBe(-587.2);
    expect(parseNum("1,234.56", ".")).toBe(1234.56);
    expect(parseNum("12,5-", ",")).toBe(-12.5);
    expect(parseNum("", ",")).toBe(null);
    expect(detectDecimal(["7,34", "-587,20", "1.526,72"])).toBe(",");
    expect(detectDecimal(["200.00", "-401.00", "0.001"])).toBe(".");
  });
  it("parst Datumsformate", () => {
    expect(parseDate("2024-10-23")).toBe("2024-10-23");
    expect(parseDate("23.10.2024")).toBe("2024-10-23");
    expect(parseDate("2026-01-19T13:31:47.160Z")).toBe("2026-01-19");
    expect(parseDate("23/10/2024")).toBe("2024-10-23");
  });
  it("erkennt Buchungsarten", () => {
    expect(classify("Verkauf")).toBe("sell");
    expect(classify("Kauf")).toBe("buy");
    expect(classify("Savings plan")).toBe("buy");
    expect(classify("SAVINGS_PLAN")).toBe("buy");
    expect(classify("Distribution")).toBe("div");
    expect(classify("BUY_CANCELLED")).toBe("skip");
    expect(classify("Deposit")).toBe("other");
    expect(classify("INTEREST_PAYMENT")).toBe("interest");
  });
});

describe("Scalable Capital", () => {
  it("liest den Export und übersetzt die Buchungen", () => {
    const f = readCsv(SCALABLE);
    expect(f.format).toBe("Scalable Capital");
    expect(f.delimiter).toBe(";");
    const { txns, stats } = toTxns(f.rows, f.map);
    expect(stats).toMatchObject({ buy: 2, sell: 1, div: 1, skipped: 2 });
    const etf = txns.find((t) => t.isin === "IE00B4L5Y983" && t.kind === "buy");
    expect(etf).toMatchObject({ type: "etf", qty: 1.234567, price: 81 });
  });
  it("Import legt Positionen, Verkäufe und Ausschüttungen an – ohne Dubletten", () => {
    const f = readCsv(SCALABLE);
    const { txns } = toTxns(f.rows, f.map);
    const d0 = { investments: [], sells: [], divs: [] };
    const plan = planImport(txns, d0, { cur: "EUR", resolved: { US9168961038: { symbol: "UEC", name: "Uranium Energy", type: "aktie" } } });
    expect(plan.lots).toHaveLength(2);
    expect(plan.sells[0]).toMatchObject({ gkey: "aktie:UEC", qty: 20 });
    expect(plan.sells[0].price).toBeCloseTo(7.29); /* 146,80 − 1,00 Gebühr */
    expect(plan.divs[0]).toMatchObject({ amt: 7.36, tax: 2.64 });
    const d1 = applyImport(d0, plan, { toCash: true, cur: "EUR" });
    const g = buildGroups(d1.investments, d1.sells, {}).find((x) => x.gkey === "aktie:UEC");
    expect(g.qty).toBe(60);
    expect(d1.investments.find((x) => x.type === "cash").price).toBeCloseTo(145.8 + 7.36);
    /* derselbe Export ein zweites Mal: alles Dubletten */
    const again = planImport(txns, d1, { cur: "EUR", resolved: { US9168961038: { symbol: "UEC", type: "aktie" } } });
    expect(again.count).toBe(0);
    expect(again.dup).toBe(4);
  });
  it("ersetzt Sparplan-Schätzungen durch die echte Ausführung", () => {
    const f = readCsv(SCALABLE);
    const { txns } = toTxns(f.rows, f.map);
    const d0 = { investments: [{ id: "est", type: "etf", symbol: "EUNL", isin: "IE00B4L5Y983", qty: 1.2, buyPrice: 83, buyDate: "2024-11-01", plan: "p", est: true }], sells: [], divs: [] };
    const plan = planImport(txns.filter((t) => t.isin === "IE00B4L5Y983"), d0, { cur: "EUR" });
    expect(plan.replaceIds).toEqual(["est"]);
    expect(plan.lots[0]).toMatchObject({ symbol: "EUNL", qty: 1.234567 });
  });
});

describe("Trade Republic", () => {
  it("ISIN in der Symbol-Spalte, Krypto-Pseudo-ISIN, Zinsen & Storno übersprungen", () => {
    const f = readCsv(TR);
    expect(f.format).toBe("Trade Republic");
    expect(f.map.isin).toBe(7);
    const { txns, stats } = toTxns(f.rows, f.map);
    expect(stats).toMatchObject({ buy: 2, interest: 1, skipped: 1 });
    expect(txns[0]).toMatchObject({ isin: "US0378331005", qty: 2, price: 200, fee: 1 });
    expect(txns[1]).toMatchObject({ type: "krypto", symbol: "BTC", qty: 0.001 });
    const plan = planImport(txns, { investments: [], sells: [], divs: [] }, { cur: "EUR" });
    expect(plan.lots[0].buyPrice).toBeCloseTo(200.5);
    expect(plan.lots[0].symbol).toBe("US0378331005"); /* ohne Ticker-Suche: ISIN als Kennung */
    expect(plan.lots[1]).toMatchObject({ type: "krypto", symbol: "BTC" });
  });
  it("Fremdwährung wird zum Kurs umgerechnet", () => {
    const csv = "Datum;Typ;ISIN;Stück;Kurs;Währung\n01.02.2025;Kauf;US0378331005;1;100;USD\n";
    const f = readCsv(csv);
    const { txns } = toTxns(f.rows, f.map);
    const plan = planImport(txns, { investments: [], sells: [], divs: [] }, { cur: "EUR", fx: { USD: 0.9 } });
    expect(plan.lots[0].buyPrice).toBeCloseTo(90);
    expect(plan.converted).toBe(1);
  });
});
