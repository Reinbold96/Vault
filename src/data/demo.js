import { uid } from "../lib/utils.js";

export const DEMO = {
  incomes: [
    { id: uid(), name: "Gehalt", type: "gehalt", amount: 4800 },
    { id: uid(), name: "Kindergeld", type: "kindergeld", amount: 259 },
    { id: uid(), name: "Elterngeld Partnerin", type: "elterngeld", amount: 1100 },
  ],
  expenses: [
    { id: uid(), name: "Miete", category: "wohnen", amount: 1250, interval: "monatlich" },
    { id: uid(), name: "Haftpflicht", category: "versicherung", amount: 89, interval: "jaehrlich" },
    { id: uid(), name: "KFZ-Versicherung", category: "versicherung", amount: 620, interval: "jaehrlich" },
    { id: uid(), name: "BU-Versicherung", category: "versicherung", amount: 78, interval: "monatlich" },
    { id: uid(), name: "Strom & Gas", category: "wohnen", amount: 180, interval: "monatlich" },
    { id: uid(), name: "Tanken Pendeln", category: "mobilitaet", amount: 320, interval: "monatlich" },
    { id: uid(), name: "Streaming & Handy", category: "abos", amount: 55, interval: "monatlich" },
    { id: uid(), name: "Lebenshaltung", category: "leben", amount: 300, interval: "monatlich" },
    { id: uid(), name: "Wocheneinkauf", category: "v_lebensmittel", amount: 480, interval: "monatlich", kind: "variabel" },
    { id: uid(), name: "Drogerie", category: "v_drogerie", amount: 60, interval: "monatlich", kind: "variabel" },
    { id: uid(), name: "Restaurant & Ausgehen", category: "v_restaurant", amount: 140, interval: "monatlich", kind: "variabel" },
    { id: uid(), name: "Sommerurlaub", category: "v_urlaub", amount: 2400, interval: "jaehrlich", kind: "variabel" },
  ],
  credits: [
    { id: uid(), name: "Autokredit", rate: 285, balance: 9400, interest: 4.9 },
  ],
  investments: [
    { id: uid(), name: "iShares Core MSCI World", symbol: "IWDA", type: "etf", qty: 42, buyPrice: 78.5, price: 92.1, buyDate: "2024-03-15" },
    { id: uid(), name: "Bitcoin", symbol: "BTC", type: "krypto", qty: 0.11, buyPrice: 38000, price: 58000, buyDate: "2024-01-20" },
    { id: uid(), name: "Apple", symbol: "AAPL", type: "aktie", qty: 10, buyPrice: 155, price: 190, buyDate: "2023-11-02" },
  ],
};
