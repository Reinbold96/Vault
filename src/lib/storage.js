/* ---------- Persistenz ----------
   - Daten + Einstellungen: localStorage (klein, synchron)
   - Kurshistorie: IndexedDB (kann mehrere MB werden; localStorage-Quota ~5 MB)
   - Backup: Export/Import mit Schema-Normalisierung und Versions-Migration */
import { CURRENCIES } from "./constants.jsx";

export const DATA_KEY = "finanz_state_v1";
export const SETTINGS_KEY = "finanz_settings_v1";
export const MASKED_KEY = "finanz_masked";
export const HIST_KEY = "vault_hist_v1"; /* alter localStorage-Schlüssel, wird migriert */
export const BACKUP_VERSION = 4;

export const EMPTY = { incomes: [], expenses: [], credits: [], investments: [], sells: [], divs: [], goals: [], cats: [], catNames: {}, snapshots: [] };

export const DEFAULT_SETTINGS = {
  finnhubKey: "", tdKey: "", currency: "EUR", theme: "system", calcMode: "surplus",
  chartBenchmarks: ["sp500"], chartRange: "6M", chartMode: "value", investSort: "size",
  taxIncome: "", taxIncomeCcy: "", splitting: false, taxState: "bw", church: false, kids: "", birth: "",
  logos: true, lockEnabled: false, lockCredId: "",
};

export function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

/* ---------- Kurshistorie in IndexedDB ---------- */
const DB_NAME = "vault";
const STORE = "hist";
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no idb")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function idbGet(key) {
  return openDb().then((db) => new Promise((res, rej) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
function idbSet(key, val) {
  return openDb().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  }));
}

/* Historie laden: IndexedDB, beim ersten Mal Migration aus localStorage */
export async function loadHist() {
  try {
    const h = await idbGet("all");
    if (h && typeof h === "object") return h;
  } catch { /* IDB nicht verfügbar → localStorage-Fallback */ }
  try {
    const legacy = JSON.parse(localStorage.getItem(HIST_KEY) || "{}");
    if (Object.keys(legacy).length) {
      try { await idbSet("all", legacy); localStorage.removeItem(HIST_KEY); } catch { /* bleibt im LS */ }
    }
    return legacy;
  } catch { return {}; }
}
/* Speichern: IDB, Fallback localStorage; liefert false, wenn nichts geklappt hat */
export async function saveHist(h) {
  try { await idbSet("all", h); return true; } catch { /* Fallback */ }
  return saveLS(HIST_KEY, h);
}

/* ---------- Backup: Schema-Normalisierung ---------- */
const str = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));
const num = (v, d = 0) => { const x = Number(v); return isFinite(x) ? x : d; };
const numOrEmpty = (v) => (v === "" || v == null ? "" : num(v));
const bool = (v) => !!v;
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const arr = (v) => (Array.isArray(v) ? v.filter((x) => obj(x)) : []);
const withId = (x, i) => ({ ...x, id: str(x.id) || `imp_${i}_${Math.random().toString(36).slice(2, 8)}` });

const flow = (f, i) => withId({ d: str(f.d), amt: num(f.amt), label: f.label == null ? undefined : str(f.label) }, i);

export function normalizeData(raw) {
  const d = obj(raw) || {};
  return {
    incomes: arr(d.incomes).map((x, i) => withId({ name: str(x.name), type: str(x.type, "sonstiges"), amount: num(x.amount) }, i)),
    expenses: arr(d.expenses).map((x, i) => withId({
      name: str(x.name), category: str(x.category, "sonstiges"), amount: num(x.amount),
      interval: x.interval === "jaehrlich" ? "jaehrlich" : "monatlich",
      kind: ["variabel", "sparen"].includes(x.kind) ? x.kind : "fix",
      until: str(x.until), notice: numOrEmpty(x.notice),
    }, i)),
    credits: arr(d.credits).map((x, i) => withId({
      name: str(x.name), rate: num(x.rate), balance: num(x.balance), interest: num(x.interest),
      paymentDay: num(x.paymentDay), endDate: str(x.endDate), fixedUntil: str(x.fixedUntil),
      followInterest: numOrEmpty(x.followInterest),
      lastAppliedIdx: typeof x.lastAppliedIdx === "number" ? x.lastAppliedIdx : undefined,
      extras: arr(x.extras).map((e, k) => withId({ d: str(e.d), amt: num(e.amt), fromCash: bool(e.fromCash) }, k)),
    }, i)),
    investments: arr(d.investments).map((x, i) => withId({
      ...x,
      name: str(x.name), symbol: str(x.symbol), type: str(x.type, "aktie"),
      qty: num(x.qty), buyPrice: num(x.buyPrice), price: num(x.price),
      buyDate: str(x.buyDate), logoUrl: str(x.logoUrl), inChart: x.inChart !== false,
      flows: Array.isArray(x.flows) ? arr(x.flows).map(flow) : undefined,
    }, i)),
    sells: arr(d.sells).map((x, i) => withId({ gkey: str(x.gkey), qty: num(x.qty), price: num(x.price), date: str(x.date) }, i)),
    divs: arr(d.divs).map((x, i) => withId({ gkey: str(x.gkey), amt: num(x.amt), date: str(x.date) }, i)),
    goals: arr(d.goals).map((x, i) => withId({ name: str(x.name), target: num(x.target), saved: num(x.saved), deadline: str(x.deadline) }, i)),
    cats: arr(d.cats).map((x, i) => withId({ label: str(x.label), kind: x.kind === "variabel" ? "variabel" : "fix", color: str(x.color, "#8a5a2b") }, i)),
    catNames: Object.fromEntries(Object.entries(obj(d.catNames) || {}).filter(([, v]) => typeof v === "string")),
    snapshots: arr(d.snapshots).filter((s) => /^\d{4}-\d{2}$/.test(str(s.m))).map((s) => ({ m: s.m, net: num(s.net), pf: num(s.pf), debt: num(s.debt) })),
  };
}

export function normalizeSettings(raw, prev = DEFAULT_SETTINGS) {
  const s = obj(raw) || {};
  const pick = (k, fn) => (k in s ? fn(s[k]) : prev[k]);
  return {
    ...prev,
    currency: CURRENCIES.includes(s.currency) ? s.currency : prev.currency,
    theme: ["light", "dark", "system"].includes(s.theme) ? s.theme : prev.theme,
    calcMode: ["surplus", "budget"].includes(s.calcMode) ? s.calcMode : prev.calcMode,
    finnhubKey: pick("finnhubKey", str), tdKey: pick("tdKey", str),
    chartBenchmarks: Array.isArray(s.chartBenchmarks) ? s.chartBenchmarks.filter((x) => typeof x === "string") : prev.chartBenchmarks,
    chartRange: pick("chartRange", str), chartMode: pick("chartMode", str), investSort: pick("investSort", str),
    taxIncome: pick("taxIncome", numOrEmpty), taxIncomeCcy: CURRENCIES.includes(s.taxIncomeCcy) ? s.taxIncomeCcy : prev.taxIncomeCcy,
    splitting: pick("splitting", bool), taxState: pick("taxState", str), church: pick("church", bool),
    kids: pick("kids", numOrEmpty), birth: pick("birth", str), logos: pick("logos", bool),
    /* App-Sperre bleibt gerätegebunden – nie aus einem Backup übernehmen */
    lockEnabled: prev.lockEnabled, lockCredId: prev.lockCredId,
  };
}

/* Backup-Datei → { data, settings } oder wirft. Versteht alle bisherigen Formate:
   v1/v2: Daten direkt · v3: {vault:3,data,settings(5 Felder)} · v4: vollständige settings */
export function parseBackup(text) {
  const parsed = JSON.parse(String(text || "").replace(/^\uFEFF/, "").trim());
  const p = obj(parsed);
  if (!p) throw new Error("kein Backup");
  const rawData = p.data && obj(p.data) ? p.data : p;
  if (!(rawData.incomes || rawData.expenses || rawData.credits || rawData.investments)) throw new Error("kein Backup");
  const version = num(p.vault, 1);
  return { version, data: normalizeData(rawData), settings: obj(p.settings) };
}

export function buildBackup(data, settings, { includeKeys = true } = {}) {
  const s = { ...settings };
  delete s.lockEnabled; delete s.lockCredId;
  if (!includeKeys) { delete s.finnhubKey; delete s.tdKey; }
  return { vault: BACKUP_VERSION, exportedAt: new Date().toISOString(), data, settings: s };
}
