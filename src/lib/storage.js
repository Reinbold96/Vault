/* ---------- Persistenz ----------
   - Daten + Einstellungen: localStorage (klein, synchron)
   - Kurshistorie: IndexedDB (kann mehrere MB werden; localStorage-Quota ~5 MB)
   - Backup: Export/Import mit Schema-Normalisierung und Versions-Migration */
import { CURRENCIES, INTERVAL_IDS } from "./constants.jsx";
import { RENEWAL_IDS } from "./contracts.js";
import { CREDIT_KIND_IDS } from "./finance.js";
import { isValidIsin, isValidWkn } from "./identifiers.js";
import { PLAN_INTERVALS } from "./plans.js";

export const DATA_KEY = "finanz_state_v1";
export const SETTINGS_KEY = "finanz_settings_v1";
export const MASKED_KEY = "finanz_masked";
export const HIST_KEY = "vault_hist_v1"; /* alter localStorage-Schlüssel, wird migriert */
export const BACKUP_VERSION = 5;

export const EMPTY = { incomes: [], expenses: [], credits: [], investments: [], sells: [], divs: [], goals: [], cats: [], catNames: {}, snapshots: [], archived: [], plans: [] };

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
function idbReq(mode, fn) {
  return openDb().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => res(out && "result" in out ? out.result : true);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  }));
}
/* Alle Einträge als [Schlüssel, Wert] */
function idbEntries() {
  return openDb().then((db) => new Promise((res, rej) => {
    const out = [];
    const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
    req.onerror = () => rej(req.error);
  }));
}
const idbPutMany = (pairs) => idbReq("readwrite", (st) => { for (const [k, v] of pairs) st.put(v, k); });
const idbDel = (key) => idbReq("readwrite", (st) => { st.delete(key); });

/* Historie: jede Serie als eigener Eintrag ("s:<schlüssel>") – beim Speichern werden nur
   die geänderten Serien geschrieben statt eines grossen Blobs. Ältere Fassungen hatten
   einen Eintrag "all" (bzw. localStorage) – der wird beim ersten Laden aufgeteilt. */
const PREFIX = "s:";
export async function loadHist() {
  try {
    const entries = await idbEntries();
    const out = {};
    let legacy = null;
    for (const [k, v] of entries) {
      if (k === "all") legacy = v;
      else if (String(k).startsWith(PREFIX)) out[String(k).slice(PREFIX.length)] = v;
    }
    if (!legacy) {
      try { const ls = JSON.parse(localStorage.getItem(HIST_KEY) || "null"); if (ls && typeof ls === "object") legacy = ls; } catch { /* ignore */ }
    }
    if (legacy && typeof legacy === "object") {
      for (const [k, v] of Object.entries(legacy)) if (!(k in out)) out[k] = v;
      try {
        await idbPutMany(Object.entries(legacy).map(([k, v]) => [PREFIX + k, v]));
        await idbDel("all");
        localStorage.removeItem(HIST_KEY);
      } catch { /* bleibt, wie es ist */ }
    }
    return out;
  } catch { /* IDB nicht verfügbar → localStorage */ }
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || "{}") || {}; } catch { return {}; }
}
/* Speichern: nur die angegebenen Serien (sonst alle); false, wenn nichts geklappt hat */
export async function saveHist(h, keys) {
  const list = (keys || Object.keys(h)).filter((k) => h[k]);
  try { await idbPutMany(list.map((k) => [PREFIX + k, h[k]])); return true; } catch { /* Fallback */ }
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

/* Postenwährung nur übernehmen, wenn gültig – sonst gilt die Anzeigewährung */
const ccyOf = (x) => (CURRENCIES.includes(x.ccy) ? { ccy: x.ccy } : {});
const flow = (f, i) => withId({ d: str(f.d), amt: num(f.amt), label: f.label == null ? undefined : str(f.label) }, i);

/* ISIN/WKN/Börse: ungültige Werte fallen weg, statt die Position zu verfälschen */
const idsOf = (x) => ({
  isin: isValidIsin(x.isin) ? String(x.isin).toUpperCase() : undefined,
  wkn: isValidWkn(x.wkn) ? String(x.wkn).toUpperCase() : undefined,
  idType: ["isin", "wkn"].includes(x.idType) ? x.idType : undefined,
  mic: typeof x.mic === "string" && /^[A-Z0-9]{3,5}$/.test(x.mic) ? x.mic : undefined,
  exchange: typeof x.exchange === "string" && x.exchange ? x.exchange.slice(0, 40) : undefined,
});

export function normalizeData(raw) {
  const d = obj(raw) || {};
  return {
    incomes: arr(d.incomes).map((x, i) => withId({ name: str(x.name), type: str(x.type, "sonstiges"), amount: num(x.amount), ...ccyOf(x) }, i)),
    expenses: arr(d.expenses).map((x, i) => withId({
      name: str(x.name), category: str(x.category, "sonstiges"), amount: num(x.amount),
      interval: INTERVAL_IDS.includes(x.interval) ? x.interval : "monatlich",
      ...ccyOf(x),
      kind: ["variabel", "sparen"].includes(x.kind) ? x.kind : "fix",
      until: str(x.until), notice: numOrEmpty(x.notice),
      noticeUnit: ["m", "w", "d"].includes(x.noticeUnit) ? x.noticeUnit : "m",
      renew: RENEWAL_IDS.includes(Number(x.renew)) ? Number(x.renew) : 0,
      remind: x.remind === true,
      ...(x.cancelled === true ? {
        cancelled: true, cancelEnd: str(x.cancelEnd), cancelledOn: str(x.cancelledOn),
        cancelConfirmed: x.cancelConfirmed === true, endAck: x.endAck === true,
      } : {}),
    }, i)),
    credits: arr(d.credits).map((x, i) => withId({
      name: str(x.name), rate: num(x.rate), balance: num(x.balance), interest: num(x.interest),
      ...(CREDIT_KIND_IDS.includes(x.kind) ? { kind: x.kind } : {}),
      paymentDay: num(x.paymentDay), endDate: str(x.endDate), fixedUntil: str(x.fixedUntil),
      followInterest: numOrEmpty(x.followInterest),
      lastAppliedIdx: typeof x.lastAppliedIdx === "number" ? x.lastAppliedIdx : undefined,
      extras: arr(x.extras).map((e, k) => withId({ d: str(e.d), amt: num(e.amt), fromCash: bool(e.fromCash) }, k)),
    }, i)),
    investments: arr(d.investments).map((x, i) => withId({
      ...x,
      ...idsOf(x),
      name: str(x.name), symbol: str(x.symbol), type: str(x.type, "aktie"),
      qty: num(x.qty), buyPrice: num(x.buyPrice), price: num(x.price),
      buyDate: str(x.buyDate), logoUrl: str(x.logoUrl), inChart: x.inChart !== false,
      flows: Array.isArray(x.flows) ? arr(x.flows).map(flow) : undefined,
    }, i)),
    sells: arr(d.sells).map((x, i) => withId({ gkey: str(x.gkey), qty: num(x.qty), price: num(x.price), date: str(x.date) }, i)),
    divs: arr(d.divs).map((x, i) => withId({ gkey: str(x.gkey), amt: num(x.amt), date: str(x.date), ...(num(x.tax) > 0 ? { tax: num(x.tax) } : {}) }, i)),
    goals: arr(d.goals).map((x, i) => withId({ name: str(x.name), target: num(x.target), saved: num(x.saved), deadline: str(x.deadline) }, i)),
    cats: arr(d.cats).map((x, i) => withId({ label: str(x.label), kind: x.kind === "variabel" ? "variabel" : "fix", color: str(x.color, "#8a5a2b") }, i)),
    catNames: Object.fromEntries(Object.entries(obj(d.catNames) || {}).filter(([, v]) => typeof v === "string")),
    archived: Array.isArray(d.archived) ? d.archived.filter((x) => typeof x === "string") : [],
    plans: arr(d.plans).map((p, i) => withId({
      gkey: str(p.gkey), tpl: obj(p.tpl) || {}, amount: num(p.amount),
      ...(num(p.fee) > 0 ? { fee: num(p.fee) } : {}),
      interval: PLAN_INTERVALS.some((x) => x.id === p.interval) ? p.interval : "monatlich",
      start: str(p.start), ...(p.end ? { end: str(p.end) } : {}),
      active: p.active !== false, lastRun: str(p.lastRun),
    }, i)).filter((p) => p.gkey && p.start && p.amount > 0),
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
   v1/v2: Daten direkt · v3: {vault:3,data,settings(5 Felder)} · v4: vollständige settings
   · v5: zusätzlich Sparpläne und einbehaltene Steuer bei Ausschüttungen */
export function parseBackup(text) {
  const parsed = JSON.parse(String(text || "").replace(/^\uFEFF/, "").trim());
  const p = obj(parsed);
  if (!p) throw new Error("kein Backup");
  const rawData = p.data && obj(p.data) ? p.data : p;
  if (!(rawData.incomes || rawData.expenses || rawData.credits || rawData.investments)) throw new Error("kein Backup");
  const version = num(p.vault, 1);
  return { version, data: normalizeData(rawData), settings: obj(p.settings) };
}

export function buildBackup(data, settings, { includeKeys = false } = {}) {
  const s = { ...settings };
  delete s.lockEnabled; delete s.lockCredId;
  if (!includeKeys) { delete s.finnhubKey; delete s.tdKey; }
  return { vault: BACKUP_VERSION, exportedAt: new Date().toISOString(), data, settings: s };
}
