import { describe, it, expect } from "vitest";
import {
  addMonthsIso, addDaysIso, diffDays, noticeDeadline, contractStatus, dueReminders, contractNote, localTodayIso,
  cancelEndFor, cancelStatus, isOver, cancelledList, statusLabel,
} from "../src/lib/contracts.js";
import { parseBackup } from "../src/lib/storage.js";

describe("Datumsrechnung", () => {
  it("Monate abziehen begrenzt auf das Monatsende", () => {
    expect(addMonthsIso("2026-05-31", -3)).toBe("2026-02-28");
    expect(addMonthsIso("2028-05-31", -3)).toBe("2028-02-29");
    expect(addMonthsIso("2026-12-31", -3)).toBe("2026-09-30");
    expect(addMonthsIso("2026-11-15", 2)).toBe("2027-01-15");
  });
  it("Tage und Differenzen ohne Zeitzonen-Versatz", () => {
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-09-29", "2026-10-01")).toBe(2);
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2); /* über die Zeitumstellung */
  });
  it("lokales Heute statt UTC-Datum", () => {
    /* 00:30 Ortszeit – in UTC wäre es in Mitteleuropa noch der Vortag */
    expect(localTodayIso(new Date(2026, 8, 30, 0, 30))).toBe("2026-09-30");
  });
  it("Kündigungsfrist in Monaten, Wochen, Tagen", () => {
    expect(noticeDeadline("2026-12-31", 3, "m")).toBe("2026-09-30");
    expect(noticeDeadline("2026-12-31", 4, "w")).toBe("2026-12-03");
    expect(noticeDeadline("2026-12-31", 14, "d")).toBe("2026-12-17");
    expect(noticeDeadline("2026-12-31", "", "m")).toBe("2026-12-31");
  });
});

describe("contractStatus", () => {
  it("ohne Laufzeitende kein Vertrag", () => {
    expect(contractStatus({ name: "Miete" }, "2026-09-29")).toBeNull();
  });
  it("offene Frist", () => {
    const st = contractStatus({ until: "2026-12-31", notice: 3, renew: 12 }, "2026-09-01");
    expect(st).toMatchObject({ end: "2026-12-31", deadline: "2026-09-30", days: 29, state: "open", renewed: false });
  });
  it("Frist verstrichen, Vertrag läuft noch", () => {
    const st = contractStatus({ until: "2026-12-31", notice: 3, renew: 12 }, "2026-10-15");
    expect(st.state).toBe("missed");
    expect(st.end).toBe("2026-12-31");
  });
  it("verlängert sich automatisch zur nächsten Laufzeit", () => {
    const st = contractStatus({ until: "2025-12-31", notice: 3, renew: 12 }, "2026-09-29");
    expect(st).toMatchObject({ end: "2026-12-31", deadline: "2026-09-30", days: 1, state: "open", renewed: true });
  });
  it("monatliche Verlängerung (z. B. nach Mindestlaufzeit)", () => {
    const st = contractStatus({ until: "2025-01-15", notice: 1, noticeUnit: "m", renew: 1 }, "2026-09-29");
    expect(st.end).toBe("2026-10-15");
    expect(st.deadline).toBe("2026-09-15");
    expect(st.state).toBe("missed");
  });
  it("Monatsende wandert bei monatlicher Verlängerung nicht (30. bleibt 30.)", () => {
    const st = contractStatus({ until: "2025-11-30", notice: 1, noticeUnit: "w", renew: 1 }, "2026-09-29");
    expect(st.end).toBe("2026-09-30");
    expect(st.deadline).toBe("2026-09-23");
    expect(contractStatus({ until: "2026-01-31", renew: 1 }, "2026-04-01").end).toBe("2026-04-30");
  });
  it("ohne Verlängerung ist der Vertrag nach Laufzeitende beendet", () => {
    expect(contractStatus({ until: "2026-01-31", notice: 3 }, "2026-09-29").state).toBe("ended");
  });
});

describe("dueReminders", () => {
  const today = "2026-09-01";
  const base = { kind: "fix", until: "2026-12-31", notice: 3, renew: 12 };
  it("zeigt nur Verträge mit gesetztem Häkchen", () => {
    const r = dueReminders([
      { ...base, id: "a", name: "Mit Häkchen", remind: true },
      { ...base, id: "b", name: "Ohne Häkchen" },
      { ...base, id: "c", name: "Häkchen aus", remind: false },
    ], today);
    expect(r.map((x) => x.item.id)).toEqual(["a"]);
  });
  it("nur innerhalb von 60 Tagen und nicht nach Fristende", () => {
    const r = dueReminders([
      { ...base, id: "soon", remind: true },
      { ...base, id: "far", remind: true, until: "2027-06-30" },
      { ...base, id: "missed", remind: true, until: "2026-10-31" },
      { ...base, id: "var", remind: true, kind: "variabel" },
    ], today);
    expect(r.map((x) => x.item.id)).toEqual(["soon"]);
  });
  it("sortiert nach Dringlichkeit", () => {
    const r = dueReminders([
      { ...base, id: "later", remind: true, until: "2027-01-31" },
      { ...base, id: "first", remind: true, notice: 14, noticeUnit: "d", until: "2026-09-20" },
    ], today);
    expect(r.map((x) => x.item.id)).toEqual(["first", "later"]);
  });
});

describe("contractNote", () => {
  it("Hinweise je Status", () => {
    expect(contractNote(contractStatus({ until: "2026-12-31", notice: 3, renew: 12 }, "2026-09-01")).text).toBe("Kündigung bis 2026-09-30");
    expect(contractNote(contractStatus({ until: "2027-12-31", notice: 3, renew: 12 }, "2026-09-01"))).toBeNull();
    expect(contractNote(contractStatus({ until: "2026-12-31", notice: 3, renew: 12 }, "2026-11-01")).tone).toBe("muted");
    expect(contractNote(contractStatus({ until: "2026-01-31" }, "2026-09-01")).text).toMatch(/abgelaufen/);
  });
});

describe("Gekündigte Verträge", () => {
  const today = "2026-09-29";
  const base = { id: "c", name: "Handy", kind: "fix", amount: 65, interval: "monatlich", until: "2026-11-30", notice: 1, noticeUnit: "m", renew: 12, remind: true };
  it("Vorschlag fürs Ende: aktuelles Laufzeitende, nach verpasster Frist das nächste", () => {
    expect(cancelEndFor(base, today)).toBe("2026-11-30");
    expect(cancelEndFor({ ...base, until: "2026-10-15" }, today)).toBe("2027-10-15");
    expect(cancelEndFor({ name: "Abo" }, today)).toBe("");
  });
  it("Status: gekündigt bis zum letzten Tag, danach beendet und nicht mehr in den Kosten", () => {
    const c = { ...base, cancelled: true, cancelEnd: "2026-11-30", cancelledOn: "2026-09-29" };
    expect(cancelStatus(c, today)).toMatchObject({ state: "cancelled", days: 62, confirmed: false });
    expect(isOver(c, "2026-11-30")).toBe(false);
    expect(isOver(c, "2026-12-01")).toBe(true);
    expect(cancelStatus(c, "2026-12-01").state).toBe("over");
    expect(statusLabel(cancelStatus(c, today))).toBe("noch 62 T.");
    expect(contractNote(cancelStatus(c, today)).text).toMatch(/Bestätigung ausstehend/);
    expect(contractNote(cancelStatus({ ...c, cancelConfirmed: true }, today)).tone).toBe("ok");
    expect(contractNote(cancelStatus(c, "2026-12-05")).text).toMatch(/zählt nicht mehr/);
  });
  it("Gekündigte erscheinen nicht mehr als fällige Erinnerung, sondern in eigener Liste", () => {
    const due = { ...base, id: "d", until: "2026-10-31" };
    const c1 = { ...base, id: "c1", cancelled: true, cancelEnd: "2026-11-30", cancelConfirmed: true };
    const c2 = { ...base, id: "c2", cancelled: true, cancelEnd: "2026-12-31" };
    const over = { ...base, id: "o", cancelled: true, cancelEnd: "2026-09-01" };
    const kept = { ...base, id: "k", cancelled: true, cancelEnd: "2026-08-01", endAck: true };
    const list = [due, c1, c2, over, kept, { ...c2, id: "v", kind: "variabel" }];
    expect(dueReminders(list, today).map((x) => x.item.id)).toEqual(["d"]);
    /* abgelaufen zuerst, dann ohne Bestätigung, dann bestätigt; "behalten" verschwindet */
    expect(cancelledList(list, today).map((x) => x.item.id)).toEqual(["o", "c2", "c1"]);
  });
  it("Backup behält Kündigungsfelder nur bei gekündigten Einträgen", () => {
    const r = parseBackup(JSON.stringify({ expenses: [
      { name: "A", amount: 1, cancelled: true, cancelEnd: "2026-11-30", cancelledOn: "2026-09-29", cancelConfirmed: true },
      { name: "B", amount: 1, cancelled: "ja", cancelEnd: "2026-11-30" },
    ] }));
    expect(r.data.expenses[0]).toMatchObject({ cancelled: true, cancelEnd: "2026-11-30", cancelConfirmed: true, endAck: false });
    expect(r.data.expenses[1].cancelled).toBeUndefined();
    expect(r.data.expenses[1].cancelEnd).toBeUndefined();
  });
});
