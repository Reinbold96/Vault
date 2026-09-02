import { describe, it, expect } from "vitest";
import { parseBackup, buildBackup, normalizeSettings, DEFAULT_SETTINGS } from "../src/lib/storage.js";

describe("Backup", () => {
  it("Export enthält Steuerprofil und alle Einstellungen, aber keine App-Sperre", () => {
    const settings = { ...DEFAULT_SETTINGS, taxIncome: 85000, taxIncomeCcy: "CHF", splitting: true, kids: 2, birth: "1990-05-01", church: true, taxState: "by", finnhubKey: "abc", lockEnabled: true, lockCredId: "xyz" };
    const b = buildBackup({ incomes: [] }, settings);
    expect(b.vault).toBe(4);
    expect(b.settings.taxIncome).toBe(85000);
    expect(b.settings.taxIncomeCcy).toBe("CHF");
    expect(b.settings.splitting).toBe(true);
    expect(b.settings.kids).toBe(2);
    expect(b.settings.birth).toBe("1990-05-01");
    expect(b.settings.church).toBe(true);
    expect(b.settings.finnhubKey).toBe("abc");
    expect(b.settings.lockEnabled).toBeUndefined();
    expect(b.settings.lockCredId).toBeUndefined();
  });
  it("Export ohne Keys lässt die Keys weg", () => {
    const b = buildBackup({}, { ...DEFAULT_SETTINGS, finnhubKey: "abc", tdKey: "def" }, { includeKeys: false });
    expect(b.settings.finnhubKey).toBeUndefined(); expect(b.settings.tdKey).toBeUndefined();
  });
  it("Roundtrip: Export → Import behält Profil", () => {
    const settings = { ...DEFAULT_SETTINGS, taxIncome: 85000, splitting: true, kids: 2 };
    const txt = JSON.stringify(buildBackup({ incomes: [{ id: "i", name: "Gehalt", type: "gehalt", amount: 5000 }] }, settings));
    const r = parseBackup(txt);
    expect(r.version).toBe(4);
    expect(r.data.incomes[0].amount).toBe(5000);
    const s = normalizeSettings(r.settings, DEFAULT_SETTINGS);
    expect(s.taxIncome).toBe(85000); expect(s.splitting).toBe(true); expect(s.kids).toBe(2);
  });
  it("überlebt kaputte Einträge (null, fehlende id, falsche Typen)", () => {
    const r = parseBackup(JSON.stringify({ incomes: [null, { name: "x", amount: "12" }, 5], expenses: [{ name: 1, amount: "abc", kind: "weird" }], credits: "nope" }));
    expect(r.data.incomes).toHaveLength(1);
    expect(r.data.incomes[0].amount).toBe(12);
    expect(r.data.incomes[0].id).toMatch(/^imp_/);
    expect(r.data.expenses[0].kind).toBe("fix");
    expect(r.data.expenses[0].amount).toBe(0);
    expect(r.data.credits).toEqual([]);
  });
  it("liest alte Formate (v1 Daten direkt, v3 mit 5 Settings)", () => {
    expect(parseBackup(JSON.stringify({ incomes: [] })).version).toBe(1);
    const r = parseBackup(JSON.stringify({ vault: 3, data: { expenses: [] }, settings: { currency: "CHF" } }));
    expect(r.version).toBe(3);
    expect(normalizeSettings(r.settings).currency).toBe("CHF");
  });
  it("lehnt Nicht-Backups ab", () => {
    expect(() => parseBackup("{}")).toThrow();
    expect(() => parseBackup("[]")).toThrow();
    expect(() => parseBackup("hallo")).toThrow();
  });
  it("App-Sperre wird nie aus dem Backup übernommen", () => {
    const s = normalizeSettings({ lockEnabled: true, lockCredId: "evil" }, DEFAULT_SETTINGS);
    expect(s.lockEnabled).toBe(false); expect(s.lockCredId).toBe("");
  });
});
