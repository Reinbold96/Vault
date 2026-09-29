/* ---------- Verträge: Laufzeit, Verlängerung, Kündigungsfrist ----------
   Reine Datumslogik auf ISO-Tagen (YYYY-MM-DD), ohne Zeitzonen-Effekte:
   gerechnet wird mit Date.UTC, "heute" ist der lokale Kalendertag. */

/* Einheiten der Kündigungsfrist */
export const NOTICE_UNITS = [
  { id: "m", label: "Monate" },
  { id: "w", label: "Wochen" },
  { id: "d", label: "Tage" },
];

/* Automatische Verlängerung nach Laufzeitende (in Monaten, 0 = endet) */
export const RENEWALS = [
  { id: 12, label: "um 12 Monate" },
  { id: 24, label: "um 24 Monate" },
  { id: 6, label: "um 6 Monate" },
  { id: 3, label: "um 3 Monate" },
  { id: 1, label: "monatlich" },
  { id: 0, label: "keine – endet" },
];
export const RENEWAL_IDS = RENEWALS.map((r) => r.id);

/* So viele Tage vor Fristende erscheint die Erinnerung auf der Übersicht */
export const REMIND_DAYS = 60;

const pad = (n) => String(n).padStart(2, "0");
const parse = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};
const fromUtc = (t) => { const x = new Date(t); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };

/* Heutiger Kalendertag in der lokalen Zeitzone (nicht UTC) */
export function localTodayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isIsoDay(iso) {
  const p = parse(iso);
  return !!p && p.m >= 1 && p.m <= 12 && p.d >= 1 && p.d <= 31;
}

/* Monate addieren; der Tag wird auf das Monatsende begrenzt (31.05. − 3 M. = 28./29.02.) */
export function addMonthsIso(iso, n) {
  const p = parse(iso);
  if (!p) return "";
  const idx = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(idx / 12), m = idx - y * 12;
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y}-${pad(m + 1)}-${pad(Math.min(p.d, dim))}`;
}

export function addDaysIso(iso, n) {
  const p = parse(iso);
  return p ? fromUtc(Date.UTC(p.y, p.m - 1, p.d) + n * 86400000) : "";
}

/* Tage von a nach b (b − a) */
export function diffDays(a, b) {
  const pa = parse(a), pb = parse(b);
  if (!pa || !pb) return NaN;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

/* Letzter Tag, an dem die Kündigung beim Anbieter eingehen muss */
export function noticeDeadline(end, notice, unit = "m") {
  const n = Math.max(0, Math.round(Number(notice) || 0));
  if (!n) return end;
  if (unit === "d") return addDaysIso(end, -n);
  if (unit === "w") return addDaysIso(end, -7 * n);
  return addMonthsIso(end, -n);
}

/* Status eines Vertrags an einem Stichtag.
   - Ohne Enddatum: null (kein Vertrag mit Laufzeit).
   - Mit Verlängerung wird das Laufzeitende so lange weitergeschoben,
     bis es heute oder in der Zukunft liegt (Vertrag hat sich verlängert).
   - state: "open"   Frist läuft noch
            "missed" Frist dieser Periode verstrichen, Vertrag läuft bis `end`
                     (und verlängert sich danach, falls renew > 0)
            "ended"  Laufzeit vorbei, keine Verlängerung */
export function contractStatus(e, today) {
  if (!e || !isIsoDay(e.until)) return null;
  const renew = RENEWAL_IDS.includes(Number(e.renew)) ? Number(e.renew) : 0;
  let end = e.until;
  let periods = 0;
  if (renew > 0) {
    /* immer vom ursprünglichen Datum aus rechnen – sonst "wandert" ein 30. nach
       dem Februar auf den 28. (30.11. → 28.02. → 28.03. …) */
    while (end < today && periods < 1200) { periods++; end = addMonthsIso(e.until, renew * periods); }
  }
  const deadline = noticeDeadline(end, e.notice, e.noticeUnit);
  const days = diffDays(today, deadline);
  const state = end < today ? "ended" : days < 0 ? "missed" : "open";
  /* Übernächstes Laufzeitende – dorthin wirkt eine Kündigung nach verpasster Frist */
  const nextEnd = renew > 0 ? addMonthsIso(e.until, renew * (periods + 1)) : "";
  return { end, nextEnd, deadline, days, renew, renewed: periods > 0, state };
}

/* Erinnerungen für die Übersicht: nur Verträge mit gesetztem Häkchen, deren
   Frist in den nächsten REMIND_DAYS Tagen endet (heute eingeschlossen).
   Ist die Frist vorbei, verschwindet die Erinnerung – die App weiss nicht,
   ob gekündigt wurde, und soll dann nicht "verpasst" behaupten. Mit
   Verlängerung taucht sie zur nächsten Frist automatisch wieder auf. */
export function dueReminders(expenses, today, windowDays = REMIND_DAYS) {
  return (expenses || [])
    .filter((e) => e && e.remind === true && e.kind !== "variabel" && e.kind !== "sparen")
    .map((e) => ({ item: e, st: contractStatus(e, today) }))
    .filter((x) => x.st && x.st.state === "open" && x.st.days <= windowDays)
    .sort((a, b) => a.st.days - b.st.days);
}

/* Hinweis in der Fixkosten-Liste (unabhängig vom Erinnerungs-Häkchen) */
export function contractNote(st, fmt = (x) => x, windowDays = REMIND_DAYS) {
  if (!st) return null;
  if (st.state === "open") return st.days <= windowDays ? { text: `Kündigung bis ${fmt(st.deadline)}`, tone: "" } : null;
  if (st.state === "missed") {
    return st.renew
      ? { text: `Frist vorbei – ohne Kündigung Verlängerung am ${fmt(st.end)}`, tone: "muted" }
      : { text: `Laufzeit endet am ${fmt(st.end)}`, tone: "muted" };
  }
  return { text: `Laufzeit am ${fmt(st.end)} abgelaufen – Eintrag prüfen`, tone: "muted" };
}

/* Kurzer Text zum Status – für Listen und die Übersicht */
export function statusLabel(st) {
  if (!st) return "";
  if (st.state === "ended") return "abgelaufen";
  if (st.state === "missed") return "Frist vorbei";
  if (st.days === 0) return "heute";
  if (st.days === 1) return "morgen";
  return `in ${st.days} T.`;
}
