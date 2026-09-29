import { describe, it, expect } from "vitest";
import {
  addMonthsIso, addDaysIso, diffDays, noticeDeadline, contractStatus, dueReminders, contractNote, localTodayIso,
} from "../src/lib/contracts.js";

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
