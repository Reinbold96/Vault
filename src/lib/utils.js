export const uid = () => Math.random().toString(36).slice(2, 10);

/* Echte Hover-Geraete (Maus/Trackpad). Auf Touch feuern Browser Fake-Mouse-Events,
   die sonst mit dem Tap-Handler kollidieren -> Auswahl wechselt erst beim 2. Tippen. */
export const CAN_HOVER = (() => {
  try { return window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch { return false; }
})();

/* "vor 3 Std." – Alter eines Zeitstempels in Worten */
export const agoLabel = (ts) => {
  if (!ts) return "";
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 2) return "gerade";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? "gestern" : `vor ${d} Tagen`;
};

export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
export const todayIso = () => isoDay(Date.now());
export const addDays = (iso, n) => isoDay(new Date(iso).getTime() + n * 86400000);
export function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
export function eachDay(startIso, endIso) {
  const out = [];
  for (let t = new Date(startIso).getTime(), e = new Date(endIso).getTime(); t <= e; t += 86400000) out.push(isoDay(t));
  return out;
}

/* 1. Januar des laufenden Jahres als ISO-Tag (Start fuer YTD) */
export const yearStartIso = () => `${new Date().getFullYear()}-01-01`;
/* Jahre zwischen zwei ISO-Tagen (Bruchteile erlaubt) */
export const yearsBetween = (a, b) => (new Date(b) - new Date(a)) / (365.2425 * 86400000);
