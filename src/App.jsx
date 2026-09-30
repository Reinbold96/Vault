import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, Suspense } from "react";
import {
  Home, LayoutGrid, Receipt, TrendingUp, Download, Upload, Wallet, Landmark, Coins, Banknote,
  Sun, Moon, Monitor, Gem, Eye, EyeOff, Fingerprint, Lock, PiggyBank, Check,
  Tag, ArrowDownWideNarrow, Layers, RefreshCw, Calculator, User, Percent, Archive, ChevronDown,
  CircleCheck, Hourglass, CalendarX, BellRing, FileUp, CalendarClock,
} from "lucide-react";
import {
  C, MASK, CURRENCIES, VALUE_TYPES, SAVE_CAT, INCOME_TYPES, INCOME_ICONS, ALL_CAT_ICONS,
  CAT_COLORS, APP_VERSION, catsOf, INTERVALS,
} from "./lib/constants.jsx";
import { agoLabel, todayIso, addDays } from "./lib/utils.js";
import { getCur, setCurrency, curSym, eur, eurFull, money, fmtQty, fmtDay, roundPrice } from "./lib/currency.js";
import { fetchFx } from "./lib/api.js";
import { bioAvailable, bioRegister, bioVerify, sessionUnlocked, markUnlocked, clearUnlocked } from "./lib/auth.js";
import {
  monthsUntil, applyDueCredits, gkeyOf, cashAmount, buildGroups, histKeyOf, costBreakdown, isImmoCredit, monthlyIn, fxOf,
} from "./lib/finance.js";
import { isClosed, perfSummary, tradeStats, holdLabel, perfGroupsOf } from "./lib/performance.js";
import { contractStatus, contractNote, dueReminders, localTodayIso, statusLabel, isOver, cancelStatus, cancelledList, cancelEndFor } from "./lib/contracts.js";
import { BUNDESLAENDER, blOf } from "./lib/tax.js";
import {
  DATA_KEY, SETTINGS_KEY, MASKED_KEY, EMPTY, DEFAULT_SETTINGS, loadLS, saveLS, loadHist, saveHist,
  parseBackup, buildBackup, normalizeSettings,
} from "./lib/storage.js";
import * as B from "./lib/booking.js";
import { fetchQuotes, applyQuotes, failedIds, quoteMessage, priceableOf } from "./lib/prices.js";
import { makeValuer, wealthSeries as buildWealthSeries, netAtSnapshot, monthKeyOf } from "./lib/wealth.js";
import { runPlans, repricePlanLots, makePlan, tplOf, nextPlanDate, planInterval, planPricer } from "./lib/plans.js";
import { convertData, conversionSummary } from "./lib/currencySwitch.js";
import { applyImport } from "./lib/csvImport.js";
import { weightOf } from "./lib/allocation.js";
import { DEMO } from "./data/demo.js";
import {
  Card, SectionTitle, Empty, Btn, SearchBar, NumInput, Field, Sub, Lead, AssetLogo, Sheet, ListItem, CashflowBar, Fresh, Seg, CheckRow,
} from "./components/ui.jsx";
import {
  IncomeForm, ExpenseForm, CreditForm, InvestForm, CatManager, GoalForm, AmountForm, DivForm, CashDetail,
  ExtraPaymentForm, CreditDetail, SellForm, AssetDetail, PlanForm,
} from "./components/forms.jsx";
import { AllocationCard } from "./components/Allocation.jsx";
import { ErrorBoundary, lazyRetry } from "./components/ErrorBoundary.jsx";

/* Schwere Teile erst laden, wenn sie gebraucht werden (Code-Splitting).
   Die Chart-Bibliothek hängt nur an diesen Bausteinen – Zahlen und Listen stehen
   sofort, Diagramme kommen einen Moment später. */
const PortfolioChart = lazyRetry(() => import("./features/PortfolioChart.jsx"));
const AmortView = lazyRetry(() => import("./features/AmortView.jsx"));
const ForecastView = lazyRetry(() => import("./features/ForecastView.jsx"));
const PropertyCalculator = lazyRetry(() => import("./features/PropertyCalculator.jsx"));
const TradeCard = lazyRetry(() => import("./features/Performance.jsx").then((m) => ({ default: m.TradeCard })));
const PerformanceSheet = lazyRetry(() => import("./features/Performance.jsx").then((m) => ({ default: m.PerformanceSheet })));
const CategoryDonut = lazyRetry(() => import("./features/HomeCharts.jsx").then((m) => ({ default: m.CategoryDonut })));
const WealthChart = lazyRetry(() => import("./features/HomeCharts.jsx").then((m) => ({ default: m.WealthChart })));
const CsvImport = lazyRetry(() => import("./components/CsvImport.jsx").then((m) => ({ default: m.CsvImport })));

/* Letzte Wechselkurse merken: offline (oder wenn die Kursdienste hängen) wird damit
   weitergerechnet statt mit 1:1 – wichtig für Posten in CHF/USD. */
const FX_KEY = "vault_fx_v1";
function readFxCache(cur) {
  try {
    const c = JSON.parse(localStorage.getItem(FX_KEY) || "null");
    return c && c.cur === cur && c.rates ? c.rates : null;
  } catch { return null; }
}
const Loading = () => <div className="fc-chart-empty" style={{ height: 120 }}>Wird geladen …</div>;
/* Nachgeladener Baustein mit Platzhalter – fällt er aus, bleibt der Rest der App stehen */
const Lazy = ({ children, fallback = <Loading />, label }) => (
  <ErrorBoundary label={label}><Suspense fallback={fallback}>{children}</Suspense></ErrorBoundary>
);
/* Zeitstempel für Abläufe ausserhalb des Renderns (Kursabruf, Timer) */
const nowMs = () => Date.now();
const lastUpdateOf = (investments) => investments.reduce((m, i) => Math.max(m, i.priceUpdated || 0), 0);
const MONTHS = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];
const monthName = (m) => { const [y, mm] = m.split("-"); return `${MONTHS[Number(mm) - 1]} ${y.slice(2)}`; };

export default function App() {
  const [data, setData] = useState(() => loadLS(DATA_KEY, EMPTY));
  const [settings, setSettingsRaw] = useState(() => {
    const s = loadLS(SETTINGS_KEY, DEFAULT_SETTINGS);
    setCurrency(s.currency); /* einmalig im Initializer, nicht im Render */
    return s;
  });
  /* Währungswechsel setzt die Formatierer synchron mit dem State */
  const setSettings = (upd) => setSettingsRaw((prev) => {
    const next = typeof upd === "function" ? upd(prev) : upd;
    if (next.currency !== prev.currency) setCurrency(next.currency);
    return next;
  });
  /* Anzeigewährung (immer eine der unterstützten – setCurrency prüft das) */
  const CUR = getCur();
  /* Immer aktueller Stand für Undo und Hintergrund-Abrufe (unabhängig vom Render-Zyklus) */
  const dataRef = useRef(data);
  const settingsRef = useRef(settings);
  useLayoutEffect(() => { dataRef.current = data; settingsRef.current = settings; });
  /* Uhr für "wie alt ist ein Kurs" – im Render nie Date.now() aufrufen */
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const onWake = () => { if (!document.hidden) tick(); };
    const t = setInterval(tick, 10 * 60000);
    document.addEventListener("visibilitychange", onWake);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onWake); };
  }, []);
  const [tab, setTab] = useState("home");
  const [costView, setCostView] = useState("fix");
  /* Sortierung der Positionsliste liegt in den Settings, damit sie erhalten bleibt */
  const investSort = ["size", "type", "day"].includes(settings.investSort) ? settings.investSort : "size";
  const setInvestSort = (v) => setSettings((x) => ({ ...x, investSort: v }));
  const [sheet, setSheet] = useState(null);
  /* Kurze Hinweise unten (statt Statusbalken oben): verschwinden nach wenigen Sekunden */
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const toastSeq = useRef(0);
  const showToast = (text, ms = 4500) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastSeq.current += 1;
    setToast({ text, id: toastSeq.current });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  /* priceBusy: irgendein Abruf läuft (dezent im Invest-Reiter) · pullBusy: vom Nutzer gezogen (Spinner oben) */
  const [priceBusy, setPriceBusy] = useState(false);
  const [pullBusy, setPullBusy] = useState(false);
  /* Letzter Abrufversuch – überlebt ein Neuladen, damit Reflex-Reloads keine Abruf-Serie auslösen */
  const lastAttempt = useRef((() => { try { return Number(localStorage.getItem("vault_px_try")) || 0; } catch { return 0; } })());
  const busyRef = useRef(false);
  const pendingForce = useRef(false);
  const [priceFailIds, setPriceFailIds] = useState([]);
  const [masked, setMasked] = useState(() => { try { return localStorage.getItem(MASKED_KEY) === "1"; } catch { return false; } });
  const [locked, setLocked] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return !!s.lockEnabled && !sessionUnlocked();
    } catch { return false; }
  });
  const [lockMsg, setLockMsg] = useState("");
  const [undo, setUndo] = useState(null);
  const [search, setSearch] = useState("");
  const [fxRates, setFxRates] = useState(() => readFxCache(settings.currency) || { EUR: 1, USD: 1, CHF: 1 });
  const [showClosed, setShowClosed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const importRef = useRef(null);

  /* Wechselkurse für Posten in Fremdwährung (1 Einheit → Anzeigewährung) */
  useEffect(() => {
    let dead = false;
    (async () => {
      const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
      const others = CURRENCIES.filter((c) => c !== cur);
      const cached = readFxCache(cur) || {};
      /* Kurse vom letzten Abruf (unter 1 Std.) reichen – beim Neuladen nicht erneut fragen */
      try {
        const c = JSON.parse(localStorage.getItem(FX_KEY) || "null");
        if (c && c.cur === cur && c.at && Date.now() - c.at < 3600000) { if (!dead) setFxRates(c.rates); return; }
      } catch { /* dann eben neu laden */ }
      const got = { [cur]: 1 };
      let complete = true;
      for (const c of others) {
        const r = await fetchFx(c, cur);
        if (r > 0) got[c] = r;
        else complete = false;
      }
      if (dead) return;
      /* Fehlt ein Kurs (offline), gilt der letzte bekannte – nach einem Währungswechsel
         sind das die bereits auf die neue Basis umgerechneten Kurse, nie 1:1 */
      const next = { ...got };
      setFxRates((prev) => {
        for (const c of others) if (!(next[c] > 0)) next[c] = cached[c] || (prev && prev[c]) || 1;
        return next;
      });
      if (complete) { try { localStorage.setItem(FX_KEY, JSON.stringify({ cur, rates: next, at: Date.now() })); } catch { /* ignore */ } }
    })();
    return () => { dead = true; };
  }, [settings.currency]);

  /* Speichern: debounced – und sofort, wenn die App in den Hintergrund geht
     oder geschlossen wird (sonst verliert eine wegwischte PWA die letzte Änderung). */
  const [saveErr, setSaveErr] = useState(false);
  useEffect(() => {
    const flush = () => { setSaveErr(!saveLS(DATA_KEY, dataRef.current)); };
    const t = setTimeout(flush, 400);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [data]);

  useEffect(() => { saveLS(SETTINGS_KEY, settings); }, [settings]);
  useEffect(() => { try { localStorage.setItem(MASKED_KEY, masked ? "1" : "0"); } catch { /* ignore */ } }, [masked]);

  /* Kurshistorie: einmal aus IndexedDB laden, danach im State halten */
  const [hist, setHist] = useState({});
  const [histReady, setHistReady] = useState(false);
  useEffect(() => { let dead = false; loadHist().then((h) => { if (!dead) { setHist(h || {}); setHistReady(true); } }); return () => { dead = true; }; }, []);
  /* Nur die geänderten Serien schreiben */
  const updateHist = async (h, keys) => { setHist({ ...h }); const ok = await saveHist(h, keys); if (!ok) showToast("Kurshistorie konnte nicht gespeichert werden (Speicher voll)"); };

  /* Entsperren per Biometrie (Face/Fingerprint), OS fällt selbst auf PIN zurück */
  async function unlock() {
    setLockMsg("");
    try {
      const ok = await bioVerify(settings.lockCredId);
      if (ok) { markUnlocked(); setLocked(false); }
      else setLockMsg("Nicht erkannt – bitte erneut versuchen.");
    } catch {
      setLockMsg("Entsperren abgebrochen oder nicht möglich.");
    }
  }

  async function enableLock() {
    setLockMsg("");
    if (!bioAvailable()) { setLockMsg("Dieses Gerät unterstützt keine Biometrie im Browser."); return; }
    try {
      const id = await bioRegister();
      if (id) { markUnlocked(); setSettings((s) => ({ ...s, lockEnabled: true, lockCredId: id })); }
      else setLockMsg("Einrichtung fehlgeschlagen.");
    } catch {
      setLockMsg("Einrichtung abgebrochen. Face ID/Fingerabdruck muss auf dem Gerät aktiv sein.");
    }
  }

  /* ---------- Theme (Hell / Dunkel / System) ---------- */
  const [systemDark, setSystemDark] = useState(() =>
    typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, []);
  const dark = settings.theme === "dark" || (settings.theme !== "light" && systemDark);
  useEffect(() => {
    const bg = dark ? "#151515" : "#ffffff";
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
    m.setAttribute("content", bg);
    document.body.style.background = bg;
  }, [dark]);

  /* Hintergrund-Scroll sperren, solange ein Sheet/Modal offen ist */
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sheet]);

  /* Auto-Tilgung: fällige Abbuchungen beim Start, beim Zurückkehren in den
     Vordergrund und stündlich nachbuchen – so stimmen Restschuld, Nettovermögen
     und alle Dashboard-Zahlen auch, wenn die App tagelang offen bleibt. */
  useEffect(() => {
    const run = () => setData((d) => applyDueCredits(d));
    run();
    const onWake = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    const t = setInterval(run, 3600000);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      clearInterval(t);
    };
  }, []);

  /* Abgeleitete Zahlen */
  /* Einnahmen und Kosten dürfen eine eigene Währung haben – gerechnet wird in der Anzeigewährung */
  const incomeTotal = useMemo(() => data.incomes.reduce((s, i) => s + (Number(i.amount) || 0) * fxOf(i.ccy, fxRates), 0), [data.incomes, fxRates]);
  const mIn = (e) => monthlyIn(e, fxRates);
  /* Fixkosten enthalten die Raten von Immobilienkrediten (Kategorie Wohnen);
     unter "Kredite" zählen im Überschuss nur noch die übrigen Kredite. */
  /* Gekündigte Verträge zählen bis zu ihrem letzten Tag – danach nicht mehr */
  const todayKey = localTodayIso();
  const activeExpenses = useMemo(() => data.expenses.filter((e) => !isOver(e, todayKey)), [data.expenses, todayKey]);
  const costs = useMemo(() => costBreakdown(activeExpenses, data.credits, fxRates), [activeExpenses, data.credits, fxRates]);
  const { fixTotal, varTotal, savingsTotal, creditRate, immoRate, otherCreditRate } = costs;
  const immoCredits = useMemo(() => data.credits.filter(isImmoCredit), [data.credits]);
  const costTotal = fixTotal + varTotal;
  const budgetMode = settings.calcMode === "budget";
  const creditBalance = useMemo(() => data.credits.reduce((s, c) => s + (Number(c.balance) || 0), 0), [data.credits]);
  const extraTotal = useMemo(
    () => data.credits.reduce((s, c) => s + (c.extras || []).reduce((a, e) => a + (Number(e.amt) || 0), 0), 0),
    [data.credits],
  );
  const surplus = incomeTotal - costTotal - otherCreditRate;
  /* Budget-Modus: was nach Fixkosten, Krediten und Sparrate für variable Ausgaben bleibt */
  const budgetTotal = incomeTotal - fixTotal - otherCreditRate - savingsTotal;
  const budgetFree = budgetTotal - varTotal;

  /* Kategorien: eingebaute + eigene, inklusive Umbenennungen */
  const fixCats = useMemo(() => catsOf("fix", { cats: data.cats, catNames: data.catNames }), [data.cats, data.catNames]);
  const varCats = useMemo(() => catsOf("variabel", { cats: data.cats, catNames: data.catNames }), [data.cats, data.catNames]);
  const allCats = useMemo(() => [...fixCats, ...varCats, SAVE_CAT], [fixCats, varCats]);
  const catCounts = useMemo(() => {
    const m = {};
    for (const e of data.expenses) m[e.category] = (m[e.category] || 0) + 1;
    return m;
  }, [data.expenses]);

  const catTotals = useMemo(() =>
    allCats.map((c) => ({
      ...c,
      value: activeExpenses.filter((e) => e.category === c.id && e.kind !== "sparen").reduce((s, e) => s + monthlyIn(e, fxRates), 0)
        + (c.id === "wohnen" ? immoRate : 0),
    })).filter((c) => c.value > 0),
  [activeExpenses, allCats, immoRate, fxRates]);

  /* Verträge: aktueller Stand je Fixkosten-Eintrag (Laufzeit, Verlängerung, Frist)
     und die Erinnerungen für die Übersicht – nur Einträge mit gesetztem Häkchen. */
  const contractInfo = useMemo(() => {
    const today = todayKey;
    const m = {};
    for (const e of data.expenses) {
      if (e.kind === "variabel" || e.kind === "sparen") continue;
      const st = cancelStatus(e, today) || contractStatus(e, today);
      if (st) m[e.id] = st;
    }
    return m;
  }, [data.expenses, todayKey]);
  const reminders = useMemo(() => dueReminders(data.expenses, todayKey), [data.expenses, todayKey]);
  const cancelledRows = useMemo(() => cancelledList(data.expenses, todayKey), [data.expenses, todayKey]);
  /* Was gekündigte (noch laufende) Verträge ab ihrem Ende monatlich sparen */
  const cancelSaving = useMemo(() => cancelledRows.filter((x) => x.st.state === "cancelled").reduce((s, x) => s + monthlyIn(x.item, fxRates), 0), [cancelledRows, fxRates]);

  /* Intervall und Originalwährung eines Postens für die Listen */
  const ivOf = (e) => INTERVALS.find((x) => x.id === e.interval) || INTERVALS[0];
  const intervalTag = (e) => (ivOf(e).tag ? <span className="fc-tag">{ivOf(e).tag}</span> : null);
  const amountSub = (e) => {
    const iv = ivOf(e);
    const foreign = e.ccy && e.ccy !== CUR;
    if (iv.months === 1) return foreign ? `${money(e.amount, e.ccy)} monatlich` : "monatlich";
    return `${foreign ? money(e.amount, e.ccy) : eurFull(e.amount)} / ${iv.per}`;
  };

  /* Positionen zu Gruppen zusammenfassen (mehrere Käufe eines Assets = eine Zeile) */
  const groups = useMemo(
    () => buildGroups(data.investments, data.sells || [], fxRates),
    [data.investments, data.sells, fxRates],
  );
  /* Tagesveränderung einer Gruppe: kommt vom Kursanbieter, gilt pro Symbol.
     Nur verwenden, wenn sie zum aktuellen Kursstand passt (max. 36 h alt). */
  const dayPctOf = (g) => {
    const r = g && g.ref;
    if (!r || typeof r.dayPct !== "number" || !isFinite(r.dayPct)) return null;
    if (r.dayPctAt && clock - r.dayPctAt > 36 * 3600 * 1000) return null;
    return r.dayPct;
  };
  const portfolioValue = useMemo(() => groups.reduce((s, g) => s + g.value, 0), [groups]);
  const netWorth = portfolioValue - creditBalance;
  /* Cash in Anzeigewährung – Basis für Sondertilgung aus Cash */
  const cashInCur = useMemo(() => {
    const c = data.investments.find((x) => x.type === "cash" && (x.ccy || CUR) === CUR);
    return c ? cashAmount(c) : 0;
  }, [data.investments, CUR]);
  /* Offene vs. abgeschlossene Positionen – Performance zählt beide */
  const openGroups = useMemo(() => groups.filter((g) => !isClosed(g)), [groups]);
  const closedGroups = useMemo(() => groups.filter(isClosed), [groups]);
  const archived = useMemo(() => new Set(data.archived || []), [data.archived]);
  /* Immobilien ohne Chart-Häkchen zählen nicht zur Performance */
  const perfGroups = useMemo(() => perfGroupsOf(groups), [groups]);
  /* Aufteilung und Anteile: offene Positionen ohne ausgeklammerte Immobilien – ein
     selbst bewohntes Haus würde sonst jede Gewichtung erdrücken */
  const allocGroups = useMemo(() => perfGroupsOf(openGroups), [openGroups]);
  const allocTotal = useMemo(() => allocGroups.reduce((s, g) => s + g.value, 0), [allocGroups]);
  const perf = useMemo(() => perfSummary(perfGroups, data.divs || []), [perfGroups, data.divs]);
  const plans = useMemo(() => data.plans || [], [data.plans]);
  const plansByGkey = useMemo(() => {
    const m = new Map();
    for (const p of plans) m.set(p.gkey, [...(m.get(p.gkey) || []), p]);
    return m;
  }, [plans]);
  const lastPriceUpdate = useMemo(() => lastUpdateOf(data.investments), [data.investments]);
  /* Sparpläne ohne bisherigen Kauf (neue Position, erster Termin steht noch aus) */
  const waitingPlans = useMemo(() => plans.filter((p) => !groups.some((g) => g.gkey === p.gkey)), [plans, groups]);

  /* ---------- Monats-Snapshots & Vermögensverlauf ----------
     Jeder Monat wird aus seinen Bausteinen frisch rekonstruiert (lib/wealth.js):
     Cash exakt am Stichtag, Wertpapiere aus der Kurshistorie, Immobilie mit aktuellem
     Wertansatz ab Kauf, Restschuld aus dem Monats-Snapshot. Einmal je Datenstand
     berechnet – nicht bei jedem Tastendruck in der Suche. */
  const monthKey = monthKeyOf();
  const hasData = data.incomes.length > 0 || data.expenses.length > 0 || data.credits.length > 0 || data.investments.length > 0;
  useEffect(() => {
    if (!hasData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Monats-Snapshot ist abgeleiteter, persistierter Zustand
    setData((d) => {
      const snaps = d.snapshots || [];
      const cur = snaps.find((s) => s.m === monthKey);
      const next = { m: monthKey, net: Math.round(netWorth), pf: Math.round(portfolioValue), debt: Math.round(creditBalance) };
      if (cur && cur.net === next.net && cur.pf === next.pf && cur.debt === next.debt) return d;
      return { ...d, snapshots: [...snaps.filter((s) => s.m !== monthKey), next].sort((a, b) => a.m.localeCompare(b.m)).slice(-120) };
    });
  }, [hasData, netWorth, portfolioValue, creditBalance, monthKey]);

  const snapshots = useMemo(() => data.snapshots || [], [data.snapshots]);
  const valuer = useMemo(() => makeValuer({ groups, hist, fxRates, cur: CUR }), [groups, hist, fxRates, CUR]);
  const wealthSeries = useMemo(
    () => buildWealthSeries({ valuer, snapshots, netWorth, creditBalance }),
    [valuer, snapshots, netWorth, creditBalance],
  );
  /* Veränderung gegenüber dem letzten abgeschlossenen Monat (gleiche Rechnung
     fuer beide Monate -> eine Ratenaenderung zaehlt nie als Verlust). */
  const lastMonthSnap = useMemo(() => {
    const prev = snapshots.filter((s) => s.m < monthKey);
    return prev.length ? prev[prev.length - 1] : null;
  }, [snapshots, monthKey]);
  const netDelta = useMemo(
    () => (lastMonthSnap ? netWorth - netAtSnapshot({ valuer, snap: lastMonthSnap, netWorth }) : null),
    [lastMonthSnap, netWorth, valuer],
  );

  /* CRUD */
  const save = (key, item) => {
    setData((d) => {
      const list = d[key];
      const exists = item.id && list.some((x) => x.id === item.id);
      return { ...d, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, { ...item, id: B.newId() }] };
    });
    setSheet(null);
  };
  /* Löschen ohne Rückfrage, dafür 8 Sekunden Rückgängig-Leiste.
     restore: zusätzlich zurückzusetzender Zustand ausserhalb der Daten (z. B. Währung) */
  const undoTimer = useRef(null);
  function withUndo(label, mutate, restore) {
    /* Zustand vor der Änderung sichern – ausserhalb des Updaters, damit er
       auch bei mehrfach ausgeführten Updates unverändert bleibt */
    const before = dataRef.current;
    setUndo({ label, before, restore });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
    const next = mutate(before);
    dataRef.current = next;
    setData(next);
  }
  function doUndo() {
    if (!undo) return;
    const { before, restore } = undo;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (restore) restore();
    setData(before);
  }
  const remove = (key, id) => {
    const item = (data[key] || []).find((x) => x.id === id);
    withUndo(`${item && item.name ? item.name : "Eintrag"} gelöscht`, (d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) }));
  };

  /* ---------- Verträge: Schnellaktionen auf der Übersicht ---------- */
  const patchExpense = (id, patch) => (d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === id ? { ...x, ...(typeof patch === "function" ? patch(x) : patch) } : x)) });
  /* "Gekündigt" direkt aus der Erinnerung: endet zum aktuellen Laufzeitende */
  function markCancelled(e) {
    const today = localTodayIso();
    withUndo(`${e.name} als gekündigt markiert`, patchExpense(e.id, (x) => ({
      cancelled: true, cancelEnd: cancelEndFor(x, today) || x.until || "", cancelledOn: today,
      cancelConfirmed: false, endAck: false, remind: false,
    })));
  }
  const confirmCancel = (e) => withUndo(`Bestätigung für ${e.name} vermerkt`, patchExpense(e.id, { cancelConfirmed: true }));
  const keepEnded = (e) => withUndo(`${e.name} bleibt in der Liste`, patchExpense(e.id, { endAck: true }));

  /* ---------- Buchungen (reine Funktionen in lib/booking.js) ---------- */
  function bookSell(gkey, s) {
    setData((d) => B.bookSell(d, gkey, { ...s, date: s.date || todayIso() }, { cur: CUR }));
    setSheet({ type: "group", gkey });
  }
  function updateSell(gkey, id, s) {
    setData((d) => B.updateSell(d, id, s));
    setSheet({ type: "group", gkey });
  }
  const removeSell = (id) => withUndo("Verkauf gelöscht", (d) => B.removeSell(d, id));
  function bookDiv(gkey, v) {
    setData((d) => B.bookDiv(d, gkey, { ...v, date: v.date || todayIso() }, { cur: CUR }));
    setSheet({ type: "group", gkey });
  }
  const removeDiv = (id) => withUndo("Ausschüttung gelöscht", (d) => B.removeDiv(d, id));
  function bookCashFlow(cashId, amt, date, label) {
    setData((d) => B.bookCashFlow(d, cashId, amt, date || todayIso(), label));
    setSheet({ type: "cash", id: cashId });
  }
  const removeCashFlow = (cashId, flowId) => withUndo("Buchung gelöscht", (d) => B.removeCashFlow(d, cashId, flowId));
  function bookExtra(creditId, e) {
    setData((d) => B.bookExtra(d, creditId, { ...e, date: e.date || todayIso() }, { cur: CUR }));
    setSheet({ type: "creditDetail", id: creditId });
  }
  const removeExtra = (creditId, extraId) => withUndo("Sondertilgung gelöscht", (d) => B.removeExtra(d, creditId, extraId));
  const toggleArchive = (gkey) => setData((d) => B.toggleArchive(d, gkey));
  function removeGroup(gkey) {
    const g = groups.find((x) => x.gkey === gkey);
    withUndo(`${g ? g.name : "Position"} gelöscht`, (d) => B.removeGroup(d, gkey));
  }

  /* ---------- Kategorien ---------- */
  function addCat(label, kind) {
    const id = `c_${B.newId()}`;
    setData((d) => {
      const used = (d.cats || []).length;
      return { ...d, cats: [...(d.cats || []), { id, label, kind: kind === "variabel" ? "variabel" : "fix", color: CAT_COLORS[used % CAT_COLORS.length] }] };
    });
    return id;
  }
  function renameCat(id, label) {
    setData((d) => ({ ...d, catNames: { ...(d.catNames || {}), [id]: label } }));
  }
  function removeCat(id) {
    withUndo("Kategorie gelöscht", (d) => ({
      ...d,
      cats: (d.cats || []).filter((c) => c.id !== id),
      catNames: Object.fromEntries(Object.entries(d.catNames || {}).filter(([k]) => k !== id)),
    }));
  }

  /* ---------- Sparziele ---------- */
  function saveGoal(g) {
    setData((d) => {
      const list = d.goals || [];
      const exists = g.id && list.some((x) => x.id === g.id);
      return { ...d, goals: exists ? list.map((x) => (x.id === g.id ? g : x)) : [...list, { ...g, id: B.newId() }] };
    });
    setSheet(null);
  }
  function addToGoal(id, amt) {
    setData((d) => ({
      ...d,
      goals: (d.goals || []).map((g) => (g.id === id ? { ...g, saved: Math.max(0, (Number(g.saved) || 0) + amt) } : g)),
    }));
  }
  function removeGoal(id) {
    const g = (data.goals || []).find((x) => x.id === id);
    withUndo(`${g ? g.name : "Ziel"} gelöscht`, (d) => ({ ...d, goals: (d.goals || []).filter((x) => x.id !== id) }));
  }

  /* Kennungen einer Position (ISIN/WKN/Börse) – aus dem ersten Kauf, der sie hat */
  const idsOf = (g) => {
    const l = (g.lots || []).find((x) => x.isin || x.wkn) || {};
    const out = {};
    for (const k of ["idType", "isin", "wkn", "mic", "exchange"]) if (l[k]) out[k] = l[k];
    if (!out.mic && g.ref.mic) { out.mic = g.ref.mic; out.exchange = g.ref.exchange || ""; }
    return out;
  };
  /* Zukauf-Formular mit den Stammdaten der Position vorbelegen */
  const addLotSheet = (g, fromTrade = false) => ({
    type: "invest",
    back: g.gkey,
    backTrade: fromTrade,
    preset: {
      type: g.type, symbol: g.ref.symbol || "", name: g.name, logoUrl: g.ref.logoUrl || "",
      ...idsOf(g),
      ...(g.ref.region ? { region: g.ref.region } : {}),
      coinId: g.ref.coinId, commodity: g.ref.commodity, unit: g.ref.unit,
      qty: "", buyPrice: "", buyDate: "", price: g.price ? String(g.price) : "", inChart: g.inChart,
    },
  });

  /* ---------- Position bearbeiten (alle Käufe: Name, Kennung, Region) ---------- */
  function savePosition(gkey, patch) {
    const g = groups.find((x) => x.gkey === gkey);
    const symChanged = g && "symbol" in patch && String(patch.symbol || "").toUpperCase() !== String(g.ref.symbol || "").toUpperCase();
    let newKey = gkey;
    withUndo(`${patch.name || (g && g.name) || "Position"} geändert`, (d) => {
      const r = B.savePosition(d, gkey, patch);
      newKey = r.gkey;
      return r.data;
    });
    setSheet({ type: "group", gkey: newKey });
    if (symChanged || (g && patch.type && patch.type !== g.type)) setTimeout(() => refreshRef.current({ force: true }), 250);
  }

  /* ---------- Sparpläne ---------- */
  function savePlan(gkey, v, existing) {
    const g = groups.find((x) => x.gkey === gkey);
    const back = g ? { type: "group", gkey } : null;
    setData((d) => {
      const list = d.plans || [];
      if (existing) {
        return { ...d, plans: list.map((p) => (p.id === existing.id ? {
          ...p, ...v, fee: v.fee > 0 ? v.fee : undefined, end: v.end || undefined,
          ...(v.px > 0 ? { px: v.px, pxAt: nowMs() } : {}),
        } : p)) };
      }
      const tpl = tplOf({ ...(g ? g.ref : {}), ...(g ? idsOf(g) : {}), name: g ? g.name : "" });
      return { ...d, plans: [...list, makePlan({ gkey, tpl, ...v })] };
    });
    setSheet(back);
  }
  function togglePlan(plan) {
    /* Fortsetzen: verpasste Termine während der Pause werden nicht nachgebucht */
    const resume = plan.active === false;
    const yesterday = addDays(localTodayIso(), -1);
    setData((d) => ({
      ...d,
      plans: (d.plans || []).map((p) => (p.id === plan.id ? { ...p, active: resume, ...(resume && (!p.lastRun || p.lastRun < yesterday) ? { lastRun: yesterday } : {}) } : p)),
    }));
  }
  function removePlan(plan) {
    withUndo("Sparplan gelöscht", (d) => ({ ...d, plans: (d.plans || []).filter((p) => p.id !== plan.id) }));
    setSheet(groups.some((g) => g.gkey === plan.gkey) ? { type: "group", gkey: plan.gkey } : null);
  }
  /* Neue Position direkt als Sparplan: Kurs holen, damit die erste Ausführung stimmt */
  async function createPlanPosition({ tpl, amount, fee, interval, start, end, px }) {
    const gkey = gkeyOf(tpl);
    const plan = { ...makePlan({ gkey, tpl: tplOf(tpl), amount, fee, interval, start, end }), ...(px > 0 ? { px } : {}) };
    if (px > 0) plan.pxAt = nowMs();
    setData((d) => ({ ...d, plans: [...(d.plans || []), plan] }));
    setSheet(null);
    let ok = px > 0;
    try {
      const s = settingsRef.current;
      const res = await fetchQuotes([{ id: plan.id, ...tpl }], { cur: getCur(), finnhubKey: s.finnhubKey, tdKey: s.tdKey });
      const q = res.byId[plan.id] || res.bySym[String(tpl.symbol || "").toUpperCase()];
      const coinId = res.resolved[String(tpl.symbol || "").toUpperCase()];
      if (q && q.price > 0) {
        ok = true;
        setData((d) => ({ ...d, plans: (d.plans || []).map((p) => (p.id === plan.id ? { ...p, px: roundPrice(q.price), pxAt: nowMs(), ...(coinId ? { tpl: { ...p.tpl, coinId } } : {}) } : p)) }));
      }
    } catch { /* dann mit dem eingetragenen Kurs */ }
    showToast(!ok
      ? "Sparplan angelegt – aber noch kein Kurs gefunden. Trag ihn unter Invest → „Wartende Sparpläne“ ein."
      : start > localTodayIso() ? `Sparplan angelegt – erste Ausführung am ${fmtDay(start)}.` : "Sparplan angelegt.", 6500);
  }
  /* Fällige Ausführungen buchen – beim Start, nach neuen Kursen/Historie und beim
     Zurückkehren in die App. Geschätzte Käufe werden mit echter Historie nachgerechnet. */
  const planCtx = useRef(null);
  useLayoutEffect(() => { planCtx.current = { groups, hist, fxRates }; });
  const planKey = plans.map((p) => `${p.id}:${p.lastRun}:${p.start}:${p.active}:${p.interval}:${p.amount}:${p.end || ""}:${p.px || ""}`).join("|");
  const groupPriceKey = groups.map((g) => `${g.gkey}:${g.price}:${g.ref.priceUpdated || 0}`).join("|");
  useEffect(() => {
    if (!histReady || !planKey) return undefined;
    const run = () => setData((d) => {
      if (!(d.plans || []).length) return d;
      const { groups: gs, hist: h, fxRates: fx } = planCtx.current;
      const cur = getCur();
      const today = localTodayIso();
      const { priceAt, current } = planPricer({ groups: gs, hist: h, fxRates: fx, cur, today });
      return repricePlanLots(runPlans(d, today, priceAt, { currentPrice: current }), priceAt, gkeyOf);
    });
    run();
    const onWake = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onWake);
    const t = setInterval(run, 3600000);
    return () => { document.removeEventListener("visibilitychange", onWake); clearInterval(t); };
  }, [histReady, planKey, hist, groupPriceKey]);

  /* ---------- Anzeigewährung wechseln ---------- */
  async function startCurrencySwitch(to) {
    if (to === CUR) return;
    setSheet({ type: "currency", to, loading: true });
    const r = await fetchFx(CUR, to);
    const fallback = fxRates[to] > 0 ? 1 / fxRates[to] : 0;
    setSheet((sh) => (sh && sh.type === "currency" && sh.to === to ? { ...sh, loading: false, rate: r || fallback, approx: !r && !!fallback } : sh));
  }
  function applyCurrencySwitch(to, rate, convert) {
    const from = CUR;
    const prevFx = fxRates;
    /* Wechselkurse sofort auf die neue Basis umrechnen – der Abruf aktualisiert danach */
    if (prevFx[to] > 0) {
      const rebased = {};
      for (const c of CURRENCIES) rebased[c] = c === to ? 1 : (Number(prevFx[c]) || 1) / prevFx[to];
      setFxRates(rebased);
    }
    const restore = () => { setSettings((s) => ({ ...s, currency: from })); setFxRates(prevFx); };
    if (convert) withUndo(`Beträge in ${to} umgerechnet`, (d) => convertData(d, from, to, rate), restore);
    else setUndo(null);
    setSettings((s) => ({ ...s, currency: to, taxIncomeCcy: s.taxIncomeCcy || from }));
    setSheet(null);
    if (!convert) showToast(`Anzeigewährung ist jetzt ${to}.`);
    setTimeout(() => refreshRef.current({ force: true }), 400);
  }

  /* ---------- CSV-Import ---------- */
  function importCsv(plan, { toCash }) {
    withUndo(`${plan.count} Buchungen importiert`, (d) => applyImport(d, plan, { toCash, cur: CUR }));
    setSheet(null);
    const newPos = plan.positions.filter((p) => p.isNew).length;
    showToast(`${plan.count} Buchungen importiert${newPos ? ` · ${newPos} neue ${newPos === 1 ? "Position" : "Positionen"}` : ""}.`);
    if (newPos) setTimeout(() => refreshRef.current({ force: true }), 400);
  }

  /* Suchfilter für Listen */
  const q = search.trim().toLowerCase();
  const matches = (...fields) => !q || fields.some((f) => String(f || "").toLowerCase().includes(q));

  /* Neue Fassung erzwingen: Service Worker aktualisieren, Caches leeren, neu laden */
  async function checkForUpdate() {
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
      for (const r of regs) if (r.waiting) r.waiting.postMessage("skipWaiting");
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* trotzdem neu laden */ }
    window.location.reload();
  }

  /* ---------- Live-Kurse (lib/prices.js) ----------
     manual: vom Nutzer ausgelöst (Ziehen) · force: nach einer Änderung (neue Kennung,
     Import, Währungswechsel) – ohne Sperrfrist. Die angezeigten Kurse bleiben stehen,
     bis neue da sind; sie werden nur ausgetauscht und blenden sich sanft ein. */
  const PULL_COOLDOWN = 60000;      /* Ziehen innerhalb 1 Min. nach dem letzten Abruf: kein neuer API-Call */
  const AUTO_MIN_AGE = 5 * 60000;   /* App-Start: nur abrufen, wenn der letzte Stand älter als 5 Min. ist */
  async function refreshPrices({ manual = false, force = false } = {}) {
    const items = priceableOf(dataRef.current.investments);
    /* Ref statt State: Effekte mit alter Closure sollen keinen zweiten Abruf starten.
       Ein erzwungener Abruf während eines laufenden wird danach nachgeholt. */
    if (busyRef.current) { if (force) pendingForce.current = true; return; }
    if (!items.length) return;
    const lastUp = lastUpdateOf(dataRef.current.investments);
    const now0 = nowMs();
    if (!force) {
      if (!manual && now0 - lastAttempt.current < AUTO_MIN_AGE) return;
      if (manual && now0 - Math.max(lastUp, lastAttempt.current) < PULL_COOLDOWN) {
        /* Reflex-Ziehen: kurz Rückmeldung geben, aber die Kursdienste nicht erneut fragen */
        setPullBusy(true);
        setTimeout(() => setPullBusy(false), 450);
        return;
      }
    }
    lastAttempt.current = now0;
    try { localStorage.setItem("vault_px_try", String(now0)); } catch { /* egal */ }
    busyRef.current = true;
    setPriceBusy(true);
    if (manual) setPullBusy(true);
    const cur = getCur();
    const s = settingsRef.current;
    let res;
    try { res = await fetchQuotes(items, { cur, finnhubKey: s.finnhubKey, tdKey: s.tdKey }); }
    catch { res = { bySym: {}, byId: {}, resolved: {}, failed: [], notes: [] }; }
    /* Währung inzwischen gewechselt? Dann passen die Kurse nicht mehr */
    if (cur === getCur()) {
      const now = nowMs();
      setData((d) => { const inv = applyQuotes(d.investments, res, now); return inv === d.investments ? d : { ...d, investments: inv }; });
      if (manual) {
        setPriceFailIds(failedIds(items, res));
        setTimeout(() => setPriceFailIds([]), 12000);
      }
      const msg = quoteMessage({ items, res, manual: manual || force, lastUpdate: lastUp, agoLabel });
      if (msg) showToast(msg);
    }
    busyRef.current = false;
    setPriceBusy(false);
    setPullBusy(false);
    if (pendingForce.current) { pendingForce.current = false; setTimeout(() => refreshRef.current({ force: true }), 300); }
  }
  /* Effekte und verzögerte Aufrufe nutzen immer die aktuelle Fassung */
  const refreshRef = useRef(null);
  useLayoutEffect(() => { refreshRef.current = refreshPrices; });

  /* Beim App-Start einmal automatisch aktualisieren (nur wenn der Stand älter als 5 Min. ist) */
  useEffect(() => {
    const inv = dataRef.current.investments;
    const last = lastUpdateOf(inv);
    if (last && Date.now() - last < 5 * 60000) return undefined;
    if (!priceableOf(inv).length) return undefined;
    const t = setTimeout(() => refreshRef.current(), 800);
    return () => clearTimeout(t);
  }, []);

  /* Kurse beim Öffnen des Invest-Reiters automatisch nachladen (max. alle 6 Stunden) */
  const autoFetched = useRef(false);
  const hasPriceable = useMemo(() => priceableOf(data.investments).length > 0, [data.investments]);
  useEffect(() => {
    if (tab !== "invest" || autoFetched.current) return;
    const stale = !lastPriceUpdate || Date.now() - lastPriceUpdate > 6 * 3600000;
    if (stale && hasPriceable) { autoFetched.current = true; refreshRef.current(); }
  }, [tab, lastPriceUpdate, hasPriceable]);

  /* ---------- Herunterziehen aktualisiert die Kurse ---------- */
  const [pullPx, setPullPx] = useState(0);
  const pullRef = useRef({ y0: null, active: false, dist: 0 });
  useEffect(() => {
    const LIMIT = 90, THRESHOLD = 62;
    const top = () => (document.scrollingElement || document.documentElement).scrollTop;
    const reset = () => { pullRef.current = { y0: null, active: false, dist: 0 }; setPullPx(0); };
    const onStart = (e) => {
      if (e.touches.length !== 1 || sheet || locked || priceBusy) { reset(); return; }
      pullRef.current = { y0: e.touches[0].clientY, active: top() <= 0, dist: 0 };
    };
    const onMove = (e) => {
      const st = pullRef.current;
      if (!st.active || st.y0 == null) return;
      const dy = e.touches[0].clientY - st.y0;
      if (dy <= 0 || top() > 0) { st.dist = 0; setPullPx(0); return; }
      st.dist = Math.min(dy * 0.45, LIMIT);
      setPullPx(st.dist);
      if (e.cancelable) e.preventDefault(); /* Rubber-Band und Browser-Reload unterdrücken */
    };
    const onEnd = () => {
      const fire = pullRef.current.dist >= THRESHOLD;
      reset();
      if (fire && !priceBusy) refreshRef.current({ manual: true });
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [sheet, locked, priceBusy]);

  /* ---------- Backup: Export / Import ---------- */
  /* API-Keys standardmässig NICHT ins Backup – die Datei landet oft in Cloud-Ordnern */
  const [exportKeys, setExportKeys] = useState(false);
  const [showFhKey, setShowFhKey] = useState(false);
  const [showTdKey, setShowTdKey] = useState(false);
  function exportData() {
    const payload = buildBackup(data, settings, { includeKeys: exportKeys });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const reader = new FileReader();
    const flash = (msg) => showToast(msg, 6000);
    reader.onload = () => {
      try {
        /* Erst vollständig validieren – dann in den State. Ein kaputtes Backup
           darf niemals einen Zustand hinterlassen, der die App nicht mehr startet. */
        const { data: clean, settings: s, version } = parseBackup(reader.result);
        setData(clean);
        if (s) setSettings((prev) => normalizeSettings(s, prev));
        const n = clean.incomes.length + clean.expenses.length + clean.credits.length + clean.investments.length + clean.sells.length;
        setSheet(null);
        flash(`Backup (v${version}) importiert – ${n} Einträge${s ? (s.taxIncome != null ? " inkl. Profil & Einstellungen" : " inkl. Einstellungen") : ""}`);
      } catch {
        flash("Import fehlgeschlagen – Datei ist kein gültiges Vault-Backup");
      }
    };
    reader.onerror = () => flash("Datei konnte nicht gelesen werden");
    reader.readAsText(file);
  }

  const monthLabel = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const eurM = (v) => (masked ? MASK : eur(v));

  const isEmpty = !data.incomes.length && !data.expenses.length && !data.credits.length && !data.investments.length;

  return (
    <div className={`fc-root ${dark ? "dark" : ""}`}>

      {(pullPx > 0 || pullBusy) && (
        <div
          className="fc-pull"
          style={{
            opacity: pullBusy ? 1 : Math.min(1, pullPx / 40),
            transform: `translateY(${pullBusy ? 14 : Math.max(4, pullPx - 12)}px)`,
          }}
        >
          <RefreshCw size={16} strokeWidth={2} className={pullBusy ? "spin" : ""} />
        </div>
      )}

      {locked && (
        <div className="fc-lock">
          <div className="fc-lock-inner">
            <span className="ic"><Lock size={26} strokeWidth={1.7} /></span>
            <div className="ttl">Vault ist gesperrt</div>
            <div className="txt">Mit Face ID, Fingerabdruck oder Geräte-PIN entsperren.</div>
            <Btn onClick={unlock} style={{ gap: 8 }}><Fingerprint size={17} strokeWidth={1.9} /> Entsperren</Btn>
            {lockMsg && <div className="err">{lockMsg}</div>}
            <button className="fc-lock-alt" onClick={() => { clearUnlocked(); setSettings((s) => ({ ...s, lockEnabled: false, lockCredId: "" })); setLocked(false); }}>
              Sperre deaktivieren
            </button>
          </div>
        </div>
      )}

      {/* Kopf */}
      <div className="fc-header">
        <div>
          <div className="eyebrow">{monthLabel}</div>
          <h1>
            {tab === "home" && "Vault"}
            {tab === "income" && "Einnahmen"}
            {tab === "expenses" && (costView === "fix" ? "Fixkosten" : "Variable Kosten")}
            {tab === "credits" && "Kredite"}
            {tab === "invest" && "Investments"}
            {tab === "profil" && "Profil"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {tab === "invest" && (
            <button className="fc-gear" onClick={() => setSheet({ type: "objektcheck" })} aria-label="Objekt-Check" title="Immobilien-Objekt-Check">
              <Calculator size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {saveErr && (
        <div className="fc-status" role="alert">
          Speichern fehlgeschlagen – Browser-Speicher voll? Bitte Backup exportieren.
        </div>
      )}

      {/* ---------- Übersicht ---------- */}
      {tab === "home" && (
        <>
          {isEmpty && (
            <div style={{ marginTop: 12 }}>
              <Empty
                text="Noch keine Daten erfasst. Lege in den Tabs unten los – oder starte mit Beispieldaten, um dir alles anzusehen."
                action={<Btn small onClick={() => setData(DEMO)}>Beispieldaten laden</Btn>}
              />
            </div>
          )}

          {!isEmpty && (
            <div className="fc-hero">
              <div className="num" style={{ color: netWorth >= 0 ? C.ink : C.error }}>
                <Fresh v={Math.round(netWorth)}>{eurM(netWorth)}</Fresh>
              </div>
              <div className="lbl">
                Nettovermögen
                <button
                  className="fc-eye"
                  onClick={() => setMasked((m) => !m)}
                  aria-label={masked ? "Beträge anzeigen" : "Beträge verbergen"}
                  title={masked ? "Beträge anzeigen" : "Beträge verbergen"}
                >
                  {masked ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
                </button>
              </div>
              {netDelta != null && !masked && (
                <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: netDelta >= 0 ? C.positive : C.error }}>
                  {netDelta >= 0 ? "+" : ""}{eur(netDelta)} <span style={{ color: C.mutedSoft, fontWeight: 500 }}>seit {monthName(lastMonthSnap.m)}</span>
                </div>
              )}
            </div>
          )}

          <div className="fc-kpis">
            <div className="fc-kpi"><div className="l">Einnahmen</div><div className="v">{eur(incomeTotal)}</div></div>
            <div className="fc-kpi"><div className="l">Gesamtkosten</div><div className="v">{eur(costTotal)}</div></div>
            <div className="fc-kpi">
              <div className="l" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span>{budgetMode ? SAVE_CAT.label : "Überschuss"}</span>
                <button className="fc-chip" onClick={() => setSheet({ type: "forecast" })} aria-label="Prognose öffnen"><TrendingUp size={12} strokeWidth={2} /> Prognose</button>
              </div>
              <div className="v" style={{ color: (budgetMode ? savingsTotal : surplus) >= 0 ? C.positive : C.error }}>{eur(budgetMode ? savingsTotal : surplus)}</div>
            </div>
            <div className="fc-kpi"><div className="l">Portfoliowert</div><div className="v"><Fresh v={Math.round(portfolioValue)}>{eurM(portfolioValue)}</Fresh></div></div>
          </div>

          {incomeTotal > 0 && (
            <>
              <SectionTitle>Wohin dein Geld fliesst</SectionTitle>
              <Card>
                <CashflowBar catTotals={catTotals} creditRate={otherCreditRate} surplus={surplus} savings={savingsTotal} budgetFree={budgetFree} budgetMode={budgetMode} />
              </Card>
            </>
          )}

          {catTotals.length > 0 && (
            <>
              <SectionTitle>Ausgaben nach Kategorie</SectionTitle>
              <Card>
                <Lazy label="Das Diagramm" fallback={<div className="fc-chart-skel" style={{ height: 240 }} aria-label="Diagramm wird geladen" />}>
                  <CategoryDonut catTotals={catTotals} masked={masked} />
                </Lazy>
              </Card>
            </>
          )}

          {(reminders.length > 0 || cancelledRows.length > 0) && (() => {
            /* Verträge: zuerst fällige Kündigungen, dann abgelaufene, dann gekündigte */
            const openExp = (e) => { setTab("expenses"); setCostView("fix"); setSheet({ type: "expense", item: e }); };
            const rows = [
              ...reminders.map((r) => ({ ...r, kind: "due" })),
              ...cancelledRows.filter((r) => r.st.state === "over").map((r) => ({ ...r, kind: "over" })),
              ...cancelledRows.filter((r) => r.st.state !== "over").map((r) => ({ ...r, kind: "cancelled" })),
            ];
            const shown = rows.slice(0, 6);
            /* Kurzes Datum: im laufenden Jahr ohne Jahreszahl */
            const short = (iso) => { const [y, m, d] = String(iso || "").split("-"); return y ? `${d}.${m}.${y === todayKey.slice(0, 4) ? "" : y.slice(2)}` : ""; };
            return (
              <>
                <SectionTitle right={cancelSaving > 0 ? <span className="fc-sum">spart {eur(cancelSaving)} / Monat</span> : null}>Verträge</SectionTitle>
                <Card>
                  {shown.map(({ item: e, st, kind }) => (
                    <div className={`fc-cxrow ${kind}`} key={e.id}>
                      <span className="ic" aria-hidden="true">
                        {kind === "due" ? <BellRing size={16} strokeWidth={2.2} />
                          : kind === "over" ? <CalendarX size={16} strokeWidth={2.2} />
                            : st.confirmed ? <CircleCheck size={16} strokeWidth={2.2} /> : <Hourglass size={16} strokeWidth={2.2} />}
                      </span>
                      <button type="button" className="tx" onClick={() => openExp(e)} aria-label={`${e.name} öffnen`}>
                        <span className="nm">{e.name}{kind !== "due" && <span className={`fc-tag ${kind === "over" ? "" : "ok"}`}>{kind === "over" ? "Beendet" : "Gekündigt"}</span>}</span>
                        <span className="sb">
                          {kind === "due" ? `kündigen bis ${short(st.deadline)}`
                            : kind === "over" ? `seit ${short(st.end)} · zählt nicht mehr`
                              : `${st.end ? `endet ${short(st.end)}` : "Enddatum fehlt"}${st.confirmed ? " · bestätigt" : " · Bestätigung fehlt"}`}
                        </span>
                      </button>
                      {kind === "due" && <span className="dt">{statusLabel(st)}</span>}
                      {kind === "cancelled" && st.confirmed && <span className="dt soft">{statusLabel(st)}</span>}
                      {kind === "due" && <button className="fc-chip" onClick={() => markCancelled(e)} aria-label={`${e.name} als gekündigt markieren`}><Check size={12} strokeWidth={3} />Gekündigt</button>}
                      {kind === "cancelled" && !st.confirmed && <button className="fc-chip" onClick={() => confirmCancel(e)} aria-label={`Bestätigung für ${e.name} erhalten`}><Check size={12} strokeWidth={3} />Bestätigt</button>}
                      {kind === "over" && (
                        <span className="acts">
                          <button className="fc-chip" onClick={() => remove("expenses", e.id)}>Entfernen</button>
                          <button className="fc-chip ghost" onClick={() => keepEnded(e)}>Behalten</button>
                        </span>
                      )}
                    </div>
                  ))}
                  {rows.length > shown.length && (
                    <div className="fc-detail-note" style={{ marginTop: 10 }}>
                      + {rows.length - shown.length} weitere unter Kosten → Fixkosten
                    </div>
                  )}
                </Card>
              </>
            );
          })()}

          {snapshots.length > 1 && (
            <>
              <SectionTitle right={<span className="fc-sum">{wealthSeries.length} Monate</span>}>Vermögensverlauf</SectionTitle>
              <Card>
                <Lazy label="Der Verlauf" fallback={<div className="fc-chart-skel" style={{ height: 190 }} aria-label="Verlauf wird geladen" />}>
                  <WealthChart series={wealthSeries} monthName={monthName} masked={masked} />
                </Lazy>
                <div className="fc-detail-note" style={{ marginTop: 8 }}>
                  Nettovermögen der letzten 3 Monate – jeder Monat frisch aus Cash, Wertpapieren und Immobilie (aktuelle Rate) berechnet.
                </div>
              </Card>
            </>
          )}

          <SectionTitle right={(data.goals || []).length ? <button className="fc-chip" onClick={() => setSheet({ type: "goal" })}>Neu</button> : null}>Sparziele</SectionTitle>
          <Card>
            {(data.goals || []).length === 0 ? (
              <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.45, marginBottom: 12 }}>
                  Notgroschen, Auto, Urlaub – lege Ziele fest und sieh, wann du sie erreichst.
                </div>
                <Btn small onClick={() => setSheet({ type: "goal" })}>Sparziel anlegen</Btn>
              </div>
            ) : (data.goals || []).map((g) => {
              const target = Number(g.target) || 0;
              const saved = Number(g.saved) || 0;
              const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
              const rest = Math.max(0, target - saved);
              const rate = budgetMode ? savingsTotal : surplus;
              const months = rest > 0 && rate > 0 ? Math.ceil(rest / rate) : rest <= 0 ? 0 : null;
              const dueMonths = g.deadline ? monthsUntil(g.deadline) : null;
              return (
                <div className="fc-goal" key={g.id}>
                  <div className="top">
                    <span className="nm">{g.name}</span>
                    <span className="am">{eur(saved)} / {eur(target)}</span>
                  </div>
                  <div className="track"><span style={{ width: `${pct}%`, background: rest <= 0 ? C.positive : C.rausch }} /></div>
                  <div className="meta">
                    <span>{rest <= 0 ? "Ziel erreicht" : `noch ${eur(rest)}`}</span>
                    <span>
                      {rest <= 0 ? "" : months == null ? "kein Überschuss" : `≈ ${months} Mon.`}
                      {dueMonths != null && rest > 0 && ` · Ziel in ${dueMonths} Mon.`}
                    </span>
                  </div>
                  <div className="acts">
                    <Btn small kind="ghost" onClick={() => setSheet({ type: "goalPay", id: g.id })}>Einzahlen</Btn>
                    <Btn small kind="ghost" onClick={() => setSheet({ type: "goal", item: g })}>Bearbeiten</Btn>
                    <button className="fc-del" onClick={() => removeGoal(g.id)} aria-label="Ziel löschen">–</button>
                  </div>
                </div>
              );
            })}
          </Card>

          {(data.investments.length > 0 || creditBalance > 0) && (
            <>
              <SectionTitle>Vermögen</SectionTitle>
              <Card>
                <div className="fc-item">
                  <div className="fc-item-main"><div className="fc-item-title">Gesamtvermögen</div><div className="fc-item-sub">{openGroups.length} Position(en)</div></div>
                  <div className="fc-item-value">{eurM(portfolioValue)}</div>
                </div>
                <div className="fc-item">
                  <div className="fc-item-main"><div className="fc-item-title">Restschulden</div></div>
                  <div className="fc-item-value" style={{ color: C.error }}>{masked ? MASK : `−${eur(creditBalance)}`}</div>
                </div>
                <div className="fc-item">
                  <div className="fc-item-main"><div className="fc-item-title" style={{ fontWeight: 700 }}>Nettovermögen</div></div>
                  <div className="fc-item-value" style={{ fontWeight: 700 }}>{eurM(netWorth)}</div>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* ---------- Einnahmen ---------- */}
      {tab === "income" && (
        <>
          <div className="fc-kpis" style={{ gridTemplateColumns: "1fr" }}>
            <div className="fc-kpi"><div className="l">Summe pro Monat</div><div className="v">{eur(incomeTotal)}</div></div>
          </div>
          <div style={{ height: 12 }} />
          {data.incomes.length === 0
            ? <Empty text="Erfasse Gehalt, Kindergeld, Elterngeld und weitere Zuschüsse." action={<Btn small onClick={() => setSheet({ type: "income" })}>Einnahme hinzufügen</Btn>} />
            : <Card>{data.incomes.map((i) => (
                <ListItem key={i.id}
                  lead={<Lead icon={INCOME_ICONS[i.type] || Coins} />}
                  title={i.name}
                  sub={<Sub parts={[INCOME_TYPES.find((t) => t.id === i.type)?.label, i.ccy && i.ccy !== CUR ? money(i.amount, i.ccy) : null]} />}
                  value={eur((Number(i.amount) || 0) * fxOf(i.ccy, fxRates))}
                  onEdit={() => setSheet({ type: "income", item: i })}
                  onDelete={() => remove("incomes", i.id)}
                />
              ))}</Card>}
          <div style={{ margin: "0 16px" }}><Btn onClick={() => setSheet({ type: "income" })}>Einnahme hinzufügen</Btn></div>
        </>
      )}

      {/* ---------- Kosten (Fix / Variabel) ---------- */}
      {tab === "expenses" && (
        <>
          <Seg options={[{ id: "fix", label: "Fixkosten" }, { id: "variabel", label: "Variabel" }]} value={costView} onChange={setCostView} label="Kostenart" />
          {data.expenses.filter((e) => (costView === "fix" ? e.kind !== "variabel" : e.kind === "variabel")).length > 7 && (
            <SearchBar value={search} onChange={setSearch} placeholder="Kosten suchen" />
          )}
          {costView === "fix" ? (
            <>
              <div className="fc-kpis">
                <div className="fc-kpi"><div className="l">Fixkosten / Monat</div><div className="v">{eur(fixTotal)}</div></div>
                <div className="fc-kpi"><div className="l">Versicherungen</div><div className="v">{eur(catTotals.find((c) => c.id === "versicherung")?.value || 0)}</div></div>
              </div>
              {fixCats.map((cat) => {
                const items = data.expenses.filter((e) => e.category === cat.id && e.kind !== "variabel" && e.kind !== "sparen" && matches(e.name, cat.label));
                /* Raten von Immobilienkrediten: nur Verweis, bearbeitet wird im Kredit */
                const creditRows = cat.id === "wohnen" ? immoCredits.filter((c) => matches(c.name, cat.label, "Kredit")) : [];
                if (!items.length && !creditRows.length) return null;
                const sum = items.filter((e) => !isOver(e, todayKey)).reduce((s, e) => s + mIn(e), 0) + creditRows.reduce((s, c) => s + (Number(c.rate) || 0), 0);
                return (
                  <React.Fragment key={cat.id}>
                    <SectionTitle right={<span className="fc-sum">{eur(sum)} / Monat</span>}>{cat.label}</SectionTitle>
                    <Card>
                      {creditRows.map((c) => (
                        <ListItem key={`credit_${c.id}`}
                          link
                          ariaLabel={`${c.name}: Kredit öffnen`}
                          lead={<Lead icon={Landmark} />}
                          title={c.name}
                          tag={<span className="fc-tag">Kredit</span>}
                          sub={`Restschuld ${eur(c.balance)}`}
                          value={eur(c.rate)}
                          onEdit={() => { setTab("credits"); setSearch(""); setSheet({ type: "creditDetail", id: c.id }); }}
                        />
                      ))}
                      {items.map((e) => {
                        const st = contractInfo[e.id];
                        const note = contractNote(st, fmtDay);
                        const over = !!st && st.cancelled && st.state === "over";
                        return (
                          <ListItem key={e.id}
                            lead={<Lead icon={ALL_CAT_ICONS[e.category] || Tag} />}
                            title={e.name}
                            tag={<>{intervalTag(e)}{st && st.cancelled && <span className={`fc-tag ${over ? "" : "ok"}`}>{over ? "Beendet" : "Gekündigt"}</span>}</>}
                            sub={<Sub parts={[
                              amountSub(e),
                              st && !st.cancelled ? `bis ${fmtDay(st.end)}` : null,
                            ]} />}
                            note={note ? note.text : null}
                            noteTone={note ? note.tone : ""}
                            value={over ? <span className="fc-strike">{eur(mIn(e))}</span> : eur(mIn(e))}
                            onEdit={() => setSheet({ type: "expense", item: e })}
                            onDelete={() => remove("expenses", e.id)}
                          />
                        );
                      })}
                    </Card>
                  </React.Fragment>
                );
              })}
              {data.expenses.filter((e) => e.kind !== "variabel" && e.kind !== "sparen").length === 0 && immoCredits.length === 0 && <div style={{ marginTop: 12 }}><Empty text="Erfasse Versicherungen, Miete, Abos und andere Fixkosten – monatlich oder jährlich." action={<Btn small onClick={() => setSheet({ type: "expense", kind: "fix" })}>Fixkosten hinzufügen</Btn>} /></div>}
              {budgetMode && (
                <>
                  <SectionTitle right={<span className="fc-sum">{eur(savingsTotal)} / Monat</span>}>{SAVE_CAT.label}</SectionTitle>
                  {data.expenses.filter((e) => e.kind === "sparen").length === 0
                    ? <Empty text="Lege fest, wie viel du jeden Monat fest zur Seite legst. Die Sparrate zählt nicht zu den Gesamtkosten." action={<Btn small onClick={() => setSheet({ type: "expense", kind: "sparen" })}>Sparrate festlegen</Btn>} />
                    : <Card>{data.expenses.filter((e) => e.kind === "sparen").map((e) => (
                        <ListItem key={e.id}
                          lead={<Lead icon={PiggyBank} />}
                          title={e.name}
                          tag={intervalTag(e)}
                          sub={amountSub(e)}
                          value={eur(mIn(e))}
                          onEdit={() => setSheet({ type: "expense", item: e })}
                          onDelete={() => remove("expenses", e.id)}
                        />
                      ))}</Card>}
                  <div style={{ margin: "0 16px 16px" }}><Btn kind="ghost" onClick={() => setSheet({ type: "expense", kind: "sparen" })}>Sparrate hinzufügen</Btn></div>
                </>
              )}
              <div style={{ margin: "0 16px" }}><Btn onClick={() => setSheet({ type: "expense", kind: "fix" })}>Fixkosten hinzufügen</Btn></div>
            </>
          ) : (
            <>
              <div className="fc-kpis">
                {budgetMode ? (
                  <>
                    <div className="fc-kpi">
                      <div className="l">Restliches Budget</div>
                      <div className="v" style={{ color: budgetTotal >= 0 ? C.ink : C.error }}>{eur(budgetTotal)}</div>
                      <div style={{ fontSize: 12.5, marginTop: 3, color: budgetFree >= 0 ? C.positive : C.error }}>
                        {budgetFree >= 0 ? `noch frei: ${eur(budgetFree)}` : `überzogen: ${eur(-budgetFree)}`}
                      </div>
                    </div>
                    <div className="fc-kpi"><div className="l">Davon ausgegeben</div><div className="v">{eur(varTotal)}</div></div>
                  </>
                ) : (
                  <>
                    <div className="fc-kpi"><div className="l">Variabel / Monat</div><div className="v">{eur(varTotal)}</div></div>
                    <div className="fc-kpi"><div className="l">Ø pro Tag</div><div className="v">{eur(varTotal / 30)}</div></div>
                  </>
                )}
              </div>
              {varCats.map((cat) => {
                const items = data.expenses.filter((e) => e.category === cat.id && e.kind === "variabel" && matches(e.name, cat.label));
                if (!items.length) return null;
                return (
                  <React.Fragment key={cat.id}>
                    <SectionTitle right={<span className="fc-sum">{eur(items.reduce((s, e) => s + mIn(e), 0))} / Monat</span>}>{cat.label}</SectionTitle>
                    <Card>
                      {items.map((e) => (
                        <ListItem key={e.id}
                          lead={<Lead icon={ALL_CAT_ICONS[e.category] || Tag} />}
                          title={e.name}
                          tag={intervalTag(e)}
                          sub={amountSub(e)}
                          value={eur(mIn(e))}
                          onEdit={() => setSheet({ type: "expense", item: e })}
                          onDelete={() => remove("expenses", e.id)}
                        />
                      ))}
                    </Card>
                  </React.Fragment>
                );
              })}
              {data.expenses.filter((e) => e.kind === "variabel").length === 0 && <div style={{ marginTop: 12 }}><Empty text="Erfasse variable Ausgaben wie Lebensmittel, Drogerie, Restaurant oder Urlaub – so siehst du, wohin dein Alltagsgeld fliesst." action={<Btn small onClick={() => setSheet({ type: "expense", kind: "variabel" })}>Ausgabe hinzufügen</Btn>} /></div>}
              <div style={{ margin: "0 16px" }}><Btn onClick={() => setSheet({ type: "expense", kind: "variabel" })}>Variable Kosten hinzufügen</Btn></div>
            </>
          )}
        </>
      )}

      {/* ---------- Kredite ---------- */}
      {tab === "credits" && (
        <>
          <div className="fc-kpis">
            <div className="fc-kpi"><div className="l">Raten / Monat</div><div className="v">{eur(creditRate)}</div></div>
            <div className="fc-kpi"><div className="l">Restschuld gesamt</div><div className="v">{eur(creditBalance)}</div></div>
            {extraTotal > 0 && (
              <div className="fc-kpi">
                <div className="l">Sondertilgungen</div>
                <div className="v" style={{ color: C.positive }}>{eur(extraTotal)}</div>
              </div>
            )}
          </div>
          <div style={{ height: 12 }} />
          {data.credits.length === 0
            ? <Empty text="Erfasse laufende Kredite mit Monatsrate und Restschuld." action={<Btn small onClick={() => setSheet({ type: "credit" })}>Kredit hinzufügen</Btn>} />
            : <Card>{data.credits.map((c) => (
                <ListItem key={c.id}
                  lead={<Lead icon={Landmark} />}
                  title={c.name}
                  sub={<Sub parts={[
                    `Restschuld ${eur(c.balance)}`,
                    c.interest ? `${String(c.interest).replace(".", ",")} %` : null,
                    c.paymentDay ? `am ${c.paymentDay}.` : null,
                  ]} />}
                  value={`${eur(c.rate)}/M.`}
                  onEdit={() => setSheet({ type: "creditDetail", id: c.id })}
                  onDelete={() => remove("credits", c.id)}
                />
              ))}</Card>}
          <div style={{ margin: "0 16px" }}><Btn onClick={() => setSheet({ type: "credit" })}>Kredit hinzufügen</Btn></div>
        </>
      )}

      {/* ---------- Investments ---------- */}
      {tab === "invest" && (
        <>
          <div className="fc-kpis">
            <div className="fc-kpi">
              <div className="l" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span>Portfoliowert</span>
                <button
                  className="fc-eye"
                  onClick={() => setMasked((m) => !m)}
                  aria-label={masked ? "Beträge anzeigen" : "Beträge verbergen"}
                  title={masked ? "Beträge anzeigen" : "Beträge verbergen"}
                >
                  {masked ? <EyeOff size={14} strokeWidth={1.9} /> : <Eye size={14} strokeWidth={1.9} />}
                </button>
              </div>
              <div className="v"><Fresh v={Math.round(portfolioValue)}>{eurM(portfolioValue)}</Fresh></div>
            </div>
            {/* Performance = offene Kursgewinne + realisierte Gewinne + Ausschüttungen */}
            <button type="button" className="fc-kpi fc-kpi-btn" onClick={() => setSheet({ type: "perf" })} aria-label="Performance-Bilanz öffnen">
              <div className="l">Performance <ChevronDown size={13} strokeWidth={2} style={{ transform: "rotate(-90deg)", marginLeft: 2 }} /></div>
              <div className="v" style={{ color: masked ? C.ink : perf.total >= 0 ? C.positive : C.error }}>{masked ? MASK : `${perf.total >= 0 ? "+" : "−"}${eur(Math.abs(perf.total))}`}</div>
              {(perf.realized !== 0 || perf.divTotal > 0) && (
                <div style={{ fontSize: 12.5, marginTop: 3, color: C.muted, lineHeight: 1.3 }}>
                  offen {masked ? MASK : `${perf.unreal >= 0 ? "+" : "−"}${eur(Math.abs(perf.unreal))}`}
                  {perf.realized !== 0 && <> · realisiert {masked ? MASK : `${perf.realized >= 0 ? "+" : "−"}${eur(Math.abs(perf.realized))}`}</>}
                </div>
              )}
            </button>
          </div>
          {groups.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Lazy label="Der Kursverlauf" fallback={<Card><div className="fc-chart-skel" style={{ height: 320 }} aria-label="Chart wird vorbereitet" /></Card>}>
              <PortfolioChart
                groups={groups}
                hist={hist}
                histReady={histReady}
                onHist={updateHist}
                cur={CUR}
                tdKey={settings.tdKey || ""}
                fxRates={fxRates}
                benchmarks={Array.isArray(settings.chartBenchmarks) ? settings.chartBenchmarks : []}
                onToggleBenchmark={(id) => setSettings((s) => {
                  const list = Array.isArray(s.chartBenchmarks) ? s.chartBenchmarks : [];
                  return { ...s, chartBenchmarks: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
                })}
                masked={masked}
                range={settings.chartRange || "6M"}
                mode={settings.chartMode || "value"}
                onRange={(id) => setSettings((s) => ({ ...s, chartRange: id }))}
                onMode={(m) => setSettings((s) => ({ ...s, chartMode: m }))}
              />
              </Lazy>
            </div>
          )}
          {allocGroups.length > 1 && (
            <AllocationCard
              groups={allocGroups}
              hist={hist}
              cur={CUR}
              dim={["type", "ccy", "region"].includes(settings.allocDim) ? settings.allocDim : "type"}
              onDim={(v) => setSettings((x) => ({ ...x, allocDim: v }))}
              open={!!settings.allocOpen}
              onToggle={() => setSettings((x) => ({ ...x, allocOpen: !x.allocOpen }))}
              masked={masked}
            />
          )}
          {openGroups.length > 1 && (
            <div className="fc-invest-tools">
              <SearchBar value={search} onChange={setSearch} placeholder="Suchen" />
              <Seg
                className="fc-seg-icons"
                label="Sortierung"
                value={investSort}
                onChange={setInvestSort}
                options={[
                  { id: "size", title: "Nach Grösse", aria: "Nach Grösse sortieren", label: <ArrowDownWideNarrow size={18} strokeWidth={1.7} /> },
                  { id: "type", title: "Nach Art", aria: "Nach Art sortieren", label: <Layers size={18} strokeWidth={1.7} /> },
                  { id: "day", title: "Nach Tagesveränderung", aria: "Nach Tagesveränderung sortieren", label: <Percent size={18} strokeWidth={1.7} /> },
                ]}
              />
            </div>
          )}
          {groups.length === 0
            ? <Empty text="Erfasse Aktien, ETFs und Krypto – der Ticker reicht, Name und Logo kommen automatisch. Auch Immobilien, Cash-Konten und Sparpläne lassen sich anlegen – oder importiere deine Transaktionen von Trade Republic oder Scalable Capital als CSV." action={<div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}><Btn small onClick={() => setSheet({ type: "invest" })}>Position hinzufügen</Btn><Btn small kind="ghost" onClick={() => setSheet({ type: "csv" })}>CSV importieren</Btn></div>} />
            : openGroups.length > 0 && <Card>{[...openGroups].filter((g) => matches(g.name, g.ref.symbol)).sort((a, b) => {
                if (investSort === "type") {
                  const ord = { aktie: 0, etf: 1, krypto: 2, rohstoff: 3, immobilie: 4, cash: 5 };
                  const d = (ord[a.type] ?? 9) - (ord[b.type] ?? 9);
                  if (d !== 0) return d;
                }
                if (investSort === "day") {
                  /* Positionen ohne Tagesveränderung (Cash, Immobilien, fehlende Kurse) nach unten */
                  const da = dayPctOf(a), db = dayPctOf(b);
                  if (da == null && db == null) return b.value - a.value;
                  if (da == null) return 1;
                  if (db == null) return -1;
                  if (db !== da) return db - da;
                }
                return b.value - a.value;
              }).map((g) => {
                const isCash = g.type === "cash";
                const isValue = VALUE_TYPES.includes(g.type);
                const unit = g.type === "rohstoff" ? (g.ref.unit || "Einheiten") : "Stück";
                const ccy = g.ref.ccy || CUR;
                const showPct = !isCash && g.cost > 0;
                const counted = allocGroups.includes(g);
                const weight = counted ? weightOf(g, allocTotal) : 0;
                const weightTxt = allocGroups.length > 1 && weight > 0 ? `Anteil ${weight < 1 ? "<1" : weight.toFixed(weight < 10 ? 1 : 0).replace(".", ",")} %` : null;
                const gPlans = plansByGkey.get(g.gkey) || [];
                const plan = gPlans.find((p) => p.active !== false) || gPlans[0];
                const pct = showPct ? (g.unreal / g.cost) * 100 : 0;
                const subParts = isCash
                  ? (ccy !== CUR ? [weightTxt, masked ? MASK : money(cashAmount(g.ref), ccy), `Kurs ${(fxRates[ccy] || 1).toFixed(4).replace(".", ",")}`] : [weightTxt, "Cash-Konto"])
                  : g.type === "immobilie"
                    ? (counted ? [weightTxt, "Immobilie"] : ["ohne Performance"])
                    : g.qty > 0
                      ? [
                          weightTxt,
                          `${fmtQty(g.qty)} ${g.type === "rohstoff" ? unit : "Stk"}`,
                          masked ? MASK : eur(g.price),
                        ]
                      : ["verkauft", `realisiert ${masked ? MASK : `${g.realized >= 0 ? "+" : ""}${eur(g.realized)}`}`];
                return (
                  <ListItem key={g.gkey}
                    lead={isValue
                      ? <Lead icon={g.type === "immobilie" ? Home : Banknote} />
                      : g.type === "rohstoff"
                        ? <Lead icon={Gem} />
                        : <AssetLogo inv={g.ref} enabled={settings.logos !== false} />}
                    title={g.name}
                    tag={plan ? <span className={`fc-tag ${plan.active === false ? "" : "ok"}`}>{plan.active === false ? "Sparplan pausiert" : "Sparplan"}</span> : null}
                    sub={<Sub parts={subParts} />}
                    value={
                      <span>
                        <Fresh v={Math.round(g.value * 100)}>{eurM(g.value)}</Fresh><br />
                        {investSort === "day" ? (
                          <span className="fc-gain" style={{ color: dayPctOf(g) == null ? C.mutedSoft : dayPctOf(g) >= 0 ? C.positive : C.error }}>
                            {dayPctOf(g) == null ? "–" : `${dayPctOf(g) >= 0 ? "+" : ""}${dayPctOf(g).toFixed(1).replace(".", ",")} % Tag`}
                          </span>
                        ) : (
                          <span className="fc-gain" style={{ color: showPct ? (g.unreal >= 0 ? C.positive : C.error) : C.mutedSoft }}>
                            {showPct ? `${g.unreal >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")} %` : "–"}
                          </span>
                        )}
                      </span>
                    }
                    note={g.lots.some((l) => priceFailIds.includes(l.id)) ? "Keine Live-Daten – zum manuellen Eintragen tippen" : null}
                    onEdit={() => setSheet(isCash ? { type: "cash", id: g.ref.id } : isValue ? { type: "invest", item: g.ref } : { type: "group", gkey: g.gkey })}
                    onDelete={() => removeGroup(g.gkey)}
                  />
                );
              })}</Card>}

          {/* ---------- Abgeschlossen: verkaufte Positionen, Performance bleibt erhalten ---------- */}
          {closedGroups.length > 0 && (() => {
            const visible = closedGroups
              .filter((g) => showArchived || !archived.has(g.gkey))
              .filter((g) => matches(g.name, g.ref.symbol))
              .map((g) => ({ g, st: tradeStats(g, data.divs || []) }))
              .sort((a, b) => (b.st.lastSell || "").localeCompare(a.st.lastSell || ""));
            const hiddenN = closedGroups.filter((g) => archived.has(g.gkey)).length;
            const realizedClosed = closedGroups.reduce((s2, g) => s2 + (Number(g.realized) || 0), 0);
            return (
              <Card>
                <button type="button" className="fc-closedhead" onClick={() => setShowClosed((v) => !v)} aria-expanded={showClosed}>
                  <span className="fc-lead"><Archive size={18} strokeWidth={1.75} /></span>
                  <span className="m">
                    <span className="t">Abgeschlossen</span>
                    <span className="s">{closedGroups.length} {closedGroups.length === 1 ? "Position" : "Positionen"}{hiddenN ? ` · ${hiddenN} ausgeblendet` : ""}</span>
                  </span>
                  <span className="r">
                    <span className="v" style={{ color: masked ? C.ink : realizedClosed >= 0 ? C.positive : C.error }}>
                      {masked ? MASK : `${realizedClosed >= 0 ? "+" : "−"}${eur(Math.abs(realizedClosed))}`}
                    </span>
                    <span className="s">realisiert</span>
                  </span>
                  <ChevronDown size={17} strokeWidth={2} className={`chev ${showClosed ? "open" : ""}`} />
                </button>
                {showClosed && (
                  <div style={{ marginTop: 6 }}>
                    {visible.map(({ g, st }) => (
                      <ListItem key={g.gkey}
                        lead={g.type === "rohstoff" ? <Lead icon={Gem} /> : <AssetLogo inv={g.ref} enabled={settings.logos !== false} />}
                        title={g.name}
                        tag={archived.has(g.gkey) ? <span className="fc-tag">ausgeblendet</span> : null}
                        sub={<Sub parts={[st.holdDays != null ? holdLabel(st.holdDays) : null, st.lastSell ? `verkauft ${st.lastSell.slice(8, 10)}.${st.lastSell.slice(5, 7)}.${st.lastSell.slice(2, 4)}` : "verkauft"]} />}
                        value={
                          <span>
                            <span style={{ color: masked ? C.ink : g.realized >= 0 ? C.positive : C.error }}>{masked ? MASK : `${g.realized >= 0 ? "+" : "−"}${eur(Math.abs(g.realized))}`}</span><br />
                            <span className="fc-gain" style={{ color: st.pct == null ? C.mutedSoft : st.pct >= 0 ? C.positive : C.error }}>
                              {st.pct == null ? "–" : `${st.pct >= 0 ? "+" : "−"}${Math.abs(st.pct).toFixed(1).replace(".", ",")} %`}
                            </span>
                          </span>
                        }
                        link
                        ariaLabel={`${g.name}: Details zum Verkauf`}
                        onEdit={() => setSheet({ type: "trade", gkey: g.gkey })}
                      />
                    ))}
                    {visible.length === 0 && <div className="fc-detail-note" style={{ padding: "8px 0" }}>Alle abgeschlossenen Positionen sind ausgeblendet.</div>}
                    {hiddenN > 0 && (
                      <button type="button" className="fc-mini" style={{ padding: "10px 0 2px" }} onClick={() => setShowArchived((v) => !v)}>
                        {showArchived ? "Ausgeblendete verbergen" : `${hiddenN} ausgeblendete anzeigen`}
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })()}

          {waitingPlans.length > 0 && (
            <>
              <SectionTitle>Wartende Sparpläne</SectionTitle>
              <Card>
                {waitingPlans.map((p) => {
                  const next = nextPlanDate(p, todayKey);
                  return (
                    <ListItem key={p.id}
                      link
                      ariaLabel={`Sparplan ${p.tpl.name || p.tpl.symbol} öffnen`}
                      lead={<Lead icon={CalendarClock} />}
                      title={p.tpl.name || p.tpl.symbol}
                      sub={<Sub parts={[`${eurFull(p.amount)} ${planInterval(p.interval).label}`, p.active === false ? "pausiert" : next && next > todayKey && Number(p.px) > 0 ? `ab ${fmtDay(next)}` : Number(p.px) > 0 ? "startet gleich" : "Kurs fehlt – antippen"]} />}
                      value=""
                      onEdit={() => setSheet({ type: "plan", gkey: p.gkey, id: p.id })}
                    />
                  );
                })}
              </Card>
            </>
          )}

          <div style={{ margin: "0 16px", display: "flex", gap: 12 }}>
            <Btn onClick={() => setSheet({ type: "invest" })} style={{ flex: 1 }}>+ Position</Btn>
            {groups.length > 0 && (
              <Btn kind="ghost" onClick={() => setSheet({ type: "csv" })} style={{ flex: "0 0 auto", width: "auto", gap: 6, padding: "12px 18px" }}>
                <FileUp size={16} strokeWidth={1.9} /> Import
              </Btn>
            )}
          </div>
          <div className="fc-hint">
            {priceBusy
              ? <span className="sync"><RefreshCw size={12} strokeWidth={2.2} /> Kurse werden aktualisiert …</span>
              : <>Zum Aktualisieren der Kurse die Seite nach unten ziehen{lastPriceUpdate > 0 ? ` – Stand ${agoLabel(lastPriceUpdate).replace(/\.$/, "")}` : ""}.</>}
            {" "}Krypto und Edelmetalle laufen ohne Key, Aktien und ETFs über die API-Keys in den Einstellungen.
          </div>
        </>
      )}

      {/* ---------- Sheets ---------- */}
      {sheet?.type === "income" && (
        <Sheet title={sheet.item ? "Einnahme bearbeiten" : "Neue Einnahme"} onClose={() => setSheet(null)}>
          <IncomeForm initial={sheet.item} fxRates={fxRates} onSave={(f) => save("incomes", f)} />
        </Sheet>
      )}
      {sheet?.type === "expense" && (
        <Sheet title={sheet.item ? ((sheet.item.kind === "sparen") ? "Sparrate bearbeiten" : "Ausgabe bearbeiten") : ((sheet.kind || "fix") === "variabel" ? "Neue variable Ausgabe" : (sheet.kind === "sparen" ? "Neue Sparrate" : "Neue Fixkosten"))} onClose={() => setSheet(null)}>
          <ExpenseForm
            initial={sheet.item}
            kind={sheet.kind}
            catList={((sheet.item && sheet.item.kind) || sheet.kind) === "variabel" ? varCats : fixCats}
            onAddCat={addCat}
            fxRates={fxRates}
            onSave={(f) => save("expenses", f)}
          />
        </Sheet>
      )}
      {sheet?.type === "forecast" && (
        <Sheet title="Prognose – Vermögensentwicklung" onClose={() => setSheet(null)}>
          <Lazy label="Die Prognose"><ForecastView surplus={budgetMode ? savingsTotal : surplus} startValue={netWorth} /></Lazy>
        </Sheet>
      )}
      {sheet?.type === "credit" && (
        <Sheet
          title={sheet.item ? "Kredit bearbeiten" : "Neuer Kredit"}
          onClose={() => setSheet(sheet.back ? { type: "creditDetail", id: sheet.back } : null)}
        >
          <CreditForm
            initial={sheet.item}
            onSave={(f) => { save("credits", f); if (sheet.back) setSheet({ type: "creditDetail", id: sheet.back }); }}
          />
        </Sheet>
      )}
      {sheet?.type === "creditDetail" && (() => {
        const c = data.credits.find((x) => x.id === sheet.id);
        if (!c) return null;
        return (
          <Sheet title={c.name} onClose={() => setSheet(null)}>
            <CreditDetail
              credit={c}
              onExtra={() => setSheet({ type: "extra", id: c.id })}
              onPlan={() => setSheet({ type: "plan", id: c.id })}
              onDeleteExtra={(exId) => removeExtra(c.id, exId)}
              onEdit={() => setSheet({ type: "credit", item: c, back: c.id })}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "plan" && (() => {
        const c = data.credits.find((x) => x.id === sheet.id);
        if (!c) return null;
        return (
          <Sheet title={`Tilgungsplan – ${c.name}`} onClose={() => setSheet({ type: "creditDetail", id: c.id })}>
            <Lazy label="Der Tilgungsplan"><AmortView credit={c} /></Lazy>
          </Sheet>
        );
      })()}
      {sheet?.type === "extra" && (() => {
        const c = data.credits.find((x) => x.id === sheet.id);
        if (!c) return null;
        return (
          <Sheet title={`Sondertilgung – ${c.name}`} onClose={() => setSheet({ type: "creditDetail", id: c.id })}>
            <ExtraPaymentForm credit={c} cashAvail={cashInCur} onSave={(e) => bookExtra(c.id, e)} />
          </Sheet>
        );
      })()}
      {sheet?.type === "div" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={`Ausschüttung – ${g.name}`} onClose={() => setSheet({ type: "group", gkey: g.gkey })}>
            <DivForm group={g} onSave={(v) => bookDiv(g.gkey, v)} />
          </Sheet>
        );
      })()}
      {sheet?.type === "cash" && (() => {
        const inv = data.investments.find((x) => x.id === sheet.id);
        if (!inv) return null;
        return (
          <Sheet title={inv.name} onClose={() => setSheet(null)}>
            <CashDetail
              inv={inv}
              fxRates={fxRates}
              masked={masked}
              onIn={() => setSheet({ type: "cashFlow", id: inv.id, dir: 1 })}
              onOut={() => setSheet({ type: "cashFlow", id: inv.id, dir: -1 })}
              onEdit={() => setSheet({ type: "invest", item: inv, backCash: inv.id })}
              onDeleteFlow={(fid) => removeCashFlow(inv.id, fid)}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "cashFlow" && (() => {
        const inv = data.investments.find((x) => x.id === sheet.id);
        if (!inv) return null;
        const isIn = sheet.dir > 0;
        return (
          <Sheet title={`${isIn ? "Einzahlung" : "Auszahlung"} – ${inv.name}`} onClose={() => setSheet({ type: "cash", id: inv.id })}>
            <AmountForm
              label={`Betrag (${inv.ccy || CUR})`}
              hint={`Aktueller Bestand: ${money(cashAmount(inv), inv.ccy || CUR)}`}
              cta={isIn ? "Einzahlung buchen" : "Auszahlung buchen"}
              onSave={({ amt, date }) => bookCashFlow(inv.id, isIn ? amt : -amt, date, isIn ? "Einzahlung" : "Auszahlung")}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "goal" && (
        <Sheet title={sheet.item ? "Sparziel bearbeiten" : "Neues Sparziel"} onClose={() => setSheet(null)}>
          <GoalForm initial={sheet.item} onSave={saveGoal} />
        </Sheet>
      )}
      {sheet?.type === "goalPay" && (() => {
        const g = (data.goals || []).find((x) => x.id === sheet.id);
        if (!g) return null;
        return (
          <Sheet title={`Einzahlen – ${g.name}`} onClose={() => setSheet(null)}>
            <AmountForm
              label={`Betrag (${curSym()})`}
              hint={`Bisher gespart: ${eurFull(Number(g.saved) || 0)} von ${eurFull(Number(g.target) || 0)}`}
              cta="Einzahlung buchen"
              initialDate={false}
              onSave={({ amt }) => { addToGoal(g.id, amt); setSheet(null); }}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "cats" && (
        <Sheet title="Kategorien" onClose={() => setSheet(null)}>
          <CatManager
            sections={[
              { kind: "fix", label: "Fixkosten", list: fixCats },
              { kind: "variabel", label: "Variable Kosten", list: varCats },
            ]}
            counts={catCounts}
            onRename={renameCat}
            onRemove={removeCat}
          />
        </Sheet>
      )}
      {sheet?.type === "invest" && (
        <Sheet
          title={sheet.item ? (VALUE_TYPES.includes(sheet.item.type) ? `${sheet.item.name || "Position"} bearbeiten` : "Kauf bearbeiten") : sheet.preset ? `${sheet.preset.name} zukaufen` : "Neue Position"}
          onClose={() => setSheet(sheet.back ? { type: sheet.backTrade ? "trade" : "group", gkey: sheet.back } : sheet.backCash ? { type: "cash", id: sheet.backCash } : null)}
        >
          <InvestForm
            initial={sheet.item || sheet.preset}
            onSave={(f) => { save("investments", f); if (sheet.back) setSheet({ type: "group", gkey: sheet.back }); if (sheet.backCash) setSheet({ type: "cash", id: sheet.backCash }); }}
            onSavePlan={!sheet.item && !sheet.preset ? createPlanPosition : undefined}
            finnhubKey={settings.finnhubKey}
          />
        </Sheet>
      )}
      {sheet?.type === "position" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={`${g.name} bearbeiten`} onClose={() => setSheet({ type: "group", gkey: g.gkey })}>
            <InvestForm
              mode="position"
              initial={{ type: g.type, name: g.name, symbol: g.ref.symbol || "", logoUrl: g.ref.logoUrl || "", region: g.ref.region || "", inChart: g.inChart, coinId: g.ref.coinId, ...idsOf(g) }}
              onSave={(patch) => savePosition(g.gkey, patch)}
              finnhubKey={settings.finnhubKey}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "plan" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        const existing = sheet.id ? plans.find((p) => p.id === sheet.id) : null;
        if (!g && !existing) return null;
        return (
          <Sheet title={existing ? "Sparplan bearbeiten" : `Sparplan – ${g ? g.name : ""}`} onClose={() => setSheet(g ? { type: "group", gkey: sheet.gkey } : null)}>
            <PlanForm
              initial={existing}
              group={g}
              onSave={(v) => savePlan(sheet.gkey, v, existing)}
              onDelete={existing ? () => removePlan(existing) : undefined}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "currency" && (() => {
        const sum = conversionSummary(data);
        const rate = sheet.rate || 0;
        return (
          <Sheet title={`Währung auf ${sheet.to} umstellen`} onClose={() => setSheet(null)}>
            <div className="fc-form">
              <div className="fc-detail-note" style={{ marginBottom: 14 }}>
                {sheet.loading ? "Aktueller Wechselkurs wird geholt …" : rate
                  ? <>Kurs: <b>1 {CUR} = {rate.toLocaleString("de-DE", { maximumFractionDigits: 4 })} {sheet.to}</b>{sheet.approx ? " (letzter bekannter Kurs)" : ""}.</>
                  : "Kein Wechselkurs erreichbar – ohne Kurs kann nur die Anzeige umgestellt werden."}
              </div>
              <div className="fc-detail-note" style={{ marginBottom: 14 }}>
                <b>Umrechnen</b> (empfohlen): Kaufkurse, Verkäufe, Ausschüttungen{sum.credits ? ", Kredite" : ""}{sum.goals ? ", Sparziele" : ""} und Sparpläne werden einmalig zum Kurs in {sheet.to} umgerechnet – Gewinne in % bleiben gleich.
                {sum.pinned ? ` ${sum.pinned} Einnahmen, Kosten und Cash-Konten ohne eigene Währung behalten ${CUR} und werden ab jetzt live umgerechnet.` : ""}
              </div>
              <Btn disabled={sheet.loading || !rate} onClick={() => applyCurrencySwitch(sheet.to, rate, true)}>Umstellen und umrechnen</Btn>
              <div style={{ height: 10 }} />
              <Btn kind="ghost" disabled={sheet.loading} onClick={() => applyCurrencySwitch(sheet.to, rate, false)}>Nur die Anzeige umstellen</Btn>
              <div className="fc-detail-note" style={{ marginTop: 12 }}>
                „Nur die Anzeige“ lässt alle Zahlen unverändert und liest sie ab jetzt als {sheet.to} – sinnvoll, wenn du bisher schon in {sheet.to} erfasst hast.
              </div>
            </div>
          </Sheet>
        );
      })()}
      {sheet?.type === "csv" && (
        <Sheet title="Transaktionen importieren" onClose={() => setSheet(null)}>
          <Lazy label="Der Import">
            <CsvImport data={data} cur={CUR} fxRates={fxRates} onImport={importCsv} />
          </Lazy>
        </Sheet>
      )}
      {sheet?.type === "objektcheck" && (
        <Sheet title="Objekt-Check" onClose={() => setSheet(null)}>
          <Lazy label="Der Objekt-Check">
            <PropertyCalculator
              settings={settings}
              fxRates={fxRates}
              onSaveSettings={(patch) => setSettings((x) => ({ ...x, ...patch }))}
              onAdopt={(inv) => { save("investments", inv); setSheet(null); }}
            />
          </Lazy>
        </Sheet>
      )}
      {sheet?.type === "trade" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={<>{g.name} <span className="fc-tag">abgeschlossen</span></>} onClose={() => setSheet(sheet.back ? { type: sheet.back } : null)}>
            <Lazy label="Die Trade-Karte">
              <TradeCard
                group={g}
                divs={data.divs || []}
                hist={hist[histKeyOf(g, CUR)]}
                fxRates={fxRates}
                archived={archived.has(g.gkey)}
                masked={masked}
                onRebuy={() => setSheet(addLotSheet(g, true))}
                onToggleArchive={() => toggleArchive(g.gkey)}
                onEdit={() => setSheet({ type: "group", gkey: g.gkey })}
                onDelete={() => { removeGroup(g.gkey); setSheet(null); }}
              />
            </Lazy>
          </Sheet>
        );
      })()}
      {sheet?.type === "perf" && (
        <Sheet title="Performance" onClose={() => setSheet(null)}>
          <Lazy label="Die Performance">
            <PerformanceSheet
              groups={perfGroups}
              divs={data.divs || []}
              splitting={!!settings.splitting}
              masked={masked}
              logos={settings.logos !== false}
              onOpen={(gkey) => {
                const g = groups.find((x) => x.gkey === gkey);
                if (!g) return;
                if (isClosed(g)) setSheet({ type: "trade", gkey, back: "perf" });
                else if (g.type === "cash") setSheet({ type: "cash", id: g.ref.id });
                else if (VALUE_TYPES.includes(g.type)) setSheet({ type: "invest", item: g.ref });
                else setSheet({ type: "group", gkey });
              }}
            />
          </Lazy>
        </Sheet>
      )}
      {sheet?.type === "group" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={g.name} onClose={() => setSheet(null)}>
            <AssetDetail
              group={g}
              divs={(data.divs || []).filter((x) => x.gkey === g.gkey)}
              plans={plansByGkey.get(g.gkey) || []}
              masked={masked}
              onDiv={() => setSheet({ type: "div", gkey: g.gkey })}
              onDeleteDiv={removeDiv}
              onAddLot={() => setSheet(addLotSheet(g))}
              onEditLot={(l) => setSheet({ type: "invest", item: l, back: g.gkey })}
              onDeleteLot={(id) => withUndo("Kauf gelöscht", (d) => B.removeLot(d, id))}
              onSell={() => setSheet({ type: "sell", gkey: g.gkey })}
              onEditSell={(sl) => setSheet({ type: "sell", gkey: g.gkey, edit: sl })}
              onDeleteSell={removeSell}
              onEditPosition={["aktie", "etf", "krypto"].includes(g.type) ? () => setSheet({ type: "position", gkey: g.gkey }) : undefined}
              onPlan={(p) => setSheet({ type: "plan", gkey: g.gkey, id: p ? p.id : undefined })}
              onTogglePlan={togglePlan}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "sell" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={sheet.edit ? "Verkauf bearbeiten" : `${g.name} verkaufen`} onClose={() => setSheet({ type: "group", gkey: g.gkey })}>
            <SellForm
              group={g}
              initial={sheet.edit || null}
              masked={masked}
              onSave={(s) => (sheet.edit ? updateSell(g.gkey, sheet.edit.id, s) : bookSell(g.gkey, s))}
            />
          </Sheet>
        );
      })()}
      {tab === "profil" && (
        <>
          <SectionTitle>Steuerliches Profil</SectionTitle>
          <Card>
            <Field label="Zu versteuerndes Einkommen / Jahr">
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <NumInput value={settings.taxIncome ?? ""} onChange={(v) => setSettings({ ...settings, taxIncome: v })} placeholder="optional" />
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {CURRENCIES.map((c) => (
                    <Btn
                      key={c}
                      small
                      kind={(settings.taxIncomeCcy || CUR) === c ? "primary" : "ghost"}
                      onClick={() => setSettings({ ...settings, taxIncomeCcy: c })}
                      style={{ minWidth: 44 }}
                    >{c}</Btn>
                  ))}
                </div>
              </div>
            </Field>
            {(() => {
              const sysCur = CUR;
              const incCcy = settings.taxIncomeCcy || sysCur;
              if (incCcy === sysCur || !(Number(settings.taxIncome) > 0)) return null;
              const conv = (Number(settings.taxIncome) || 0) * (fxRates[incCcy] || 1);
              return (
                <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
                  ≈ {eur(conv)} zum aktuellen Kurs – mit diesem Betrag rechnet die Steuerschätzung (Systemwährung {sysCur}).
                </div>
              );
            })()}
            <div className="fc-row2">
              <Field label="Wohnsitz (Bundesland)">
                <select value={settings.taxState || "bw"} onChange={(e) => setSettings({ ...settings, taxState: e.target.value })}>
                  {BUNDESLAENDER.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </Field>
              <Field label="Kinder (Freibeträge)">
                <NumInput value={settings.kids ?? ""} onChange={(v) => setSettings({ ...settings, kids: v })} placeholder="0" />
              </Field>
            </div>
            <Field label="Geburtsdatum">
              <input type="date" value={settings.birth || ""} onChange={(e) => setSettings({ ...settings, birth: e.target.value })} />
            </Field>
            <button type="button" className="fc-check" onClick={() => setSettings({ ...settings, splitting: !settings.splitting })}>
              <span className={`box ${settings.splitting ? "on" : ""}`}>{settings.splitting && <Check size={13} strokeWidth={3} />}</span>
              <span>Verheiratet / Zusammenveranlagung (Splitting)</span>
            </button>
            <button type="button" className="fc-check" onClick={() => setSettings({ ...settings, church: !settings.church })}>
              <span className={`box ${settings.church ? "on" : ""}`}>{settings.church && <Check size={13} strokeWidth={3} />}</span>
              <span>Kirchensteuerpflichtig ({blOf(settings.taxState || "bw")?.kist || 9} %)</span>
            </button>
            <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, marginTop: 4 }}>
              Optional, wird nur lokal gespeichert und ist im Backup enthalten. Diese Angaben machen die Steuerschätzung im Objekt-Check – und in künftigen Modulen – genauer.
            </div>
          </Card>

          <SectionTitle>Einstellungen</SectionTitle>
          <Card>
          <Field label="Berechnung der Übersicht">
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "surplus", label: "Überschuss" }, { id: "budget", label: "Budget" }].map((o) => (
                <Btn key={o.id} kind={(settings.calcMode || "surplus") === o.id ? "primary" : "ghost"} onClick={() => setSettings({ ...settings, calcMode: o.id })} style={{ flex: 1 }}>
                  {o.label}
                </Btn>
              ))}
            </div>
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            <b>Überschuss</b>: zeigt, was am Monatsende übrig bleibt.<br />
            <b>Budget</b>: du legst eine feste Sparrate fest (Reiter Kosten → Fixkosten). Sie zählt nicht zu den Gesamtkosten;
            unter „Variabel“ siehst du stattdessen dein restliches Budget.
          </div>
          <Field label="Kategorien">
            <Btn kind="ghost" onClick={() => setSheet({ type: "cats" })} style={{ gap: 8 }}>
              <Tag size={15} strokeWidth={1.9} /> Kategorien verwalten
            </Btn>
          </Field>
          <Field label="Darstellung">
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "light", label: "Hell", Ic: Sun }, { id: "dark", label: "Dunkel", Ic: Moon }, { id: "system", label: "System", Ic: Monitor }].map((o) => (
                <Btn key={o.id} kind={(settings.theme || "system") === o.id ? "primary" : "ghost"} onClick={() => setSettings({ ...settings, theme: o.id })} style={{ flex: 1, gap: 6 }}>
                  <o.Ic size={15} strokeWidth={1.9} /> {o.label}
                </Btn>
              ))}
            </div>
          </Field>
          <Field label="Währung">
            <div style={{ display: "flex", gap: 8 }}>
              {CURRENCIES.map((c) => (
                <Btn
                  key={c}
                  kind={CUR === c ? "primary" : "ghost"}
                  onClick={() => startCurrencySwitch(c)}
                  style={{ flex: 1 }}
                >
                  {c}
                </Btn>
              ))}
            </div>
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            Beim Wechsel fragt die App, ob sie deine Beträge (Kaufkurse, Kredite, Sparziele …) zum aktuellen Kurs umrechnen soll.
            Posten mit eigener Währung (z. B. Lohn oder Krankenkasse in CHF) und Live-Kurse rechnet sie ohnehin automatisch um.
          </div>
          <Field label="App-Sperre">
            {settings.lockEnabled ? (
              <Btn kind="ghost" onClick={() => { clearUnlocked(); setSettings({ ...settings, lockEnabled: false, lockCredId: "" }); }} style={{ gap: 8 }}>
                <Lock size={15} strokeWidth={1.9} /> Sperre ist aktiv – deaktivieren
              </Btn>
            ) : (
              <Btn kind="ghost" onClick={enableLock} style={{ gap: 8 }}>
                <Fingerprint size={15} strokeWidth={1.9} /> Sperre einrichten
              </Btn>
            )}
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            Schützt die App beim Öffnen. Falls keine Biometrie verfügbar ist, fragt das Gerät automatisch nach PIN/Muster.
            Hinweis: Die Daten liegen unverschlüsselt im Gerätespeicher – die Sperre schützt vor neugierigen Blicken, nicht gegen forensischen Zugriff.
            {lockMsg && <div style={{ color: C.error, marginTop: 6 }}>{lockMsg}</div>}
          </div>
          <Field label="Finnhub API-Key">
            <div className="fc-keyrow">
              <input
                type={showFhKey ? "text" : "password"}
                autoComplete="off"
                value={settings.finnhubKey}
                onChange={(e) => setSettings({ ...settings, finnhubKey: e.target.value.trim() })}
                placeholder="z. B. c1a2b3…"
              />
              <button type="button" className="fc-eye" onClick={() => setShowFhKey((v) => !v)} aria-label={showFhKey ? "Finnhub-Key verbergen" : "Finnhub-Key anzeigen"} aria-pressed={showFhKey}>
                {showFhKey ? <EyeOff size={14} strokeWidth={1.9} /> : <Eye size={14} strokeWidth={1.9} />}
              </button>
            </div>
          </Field>
          <Field label="Twelve Data API-Key">
            <div className="fc-keyrow">
              <input
                type={showTdKey ? "text" : "password"}
                autoComplete="off"
                value={settings.tdKey || ""}
                onChange={(e) => setSettings({ ...settings, tdKey: e.target.value.trim() })}
                placeholder="z. B. abcd1234…"
              />
              <button type="button" className="fc-eye" onClick={() => setShowTdKey((v) => !v)} aria-label={showTdKey ? "Twelve-Data-Key verbergen" : "Twelve-Data-Key anzeigen"} aria-pressed={showTdKey}>
                {showTdKey ? <EyeOff size={14} strokeWidth={1.9} /> : <Eye size={14} strokeWidth={1.9} />}
              </button>
            </div>
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            Finnhub (kostenlos auf finnhub.io) liefert US-Aktien und -ETFs, Twelve Data (twelvedata.com) europäische Wertpapiere und Öl. Aktien und ETFs lassen sich auch per ISIN oder WKN anlegen – die App sucht den passenden Ticker dazu.
            Krypto und Edelmetalle laufen ohne Key.
          </div>
          <button type="button" className="fc-check" onClick={() => setSettings({ ...settings, logos: settings.logos === false })}>
            <span className={`box ${settings.logos !== false ? "on" : ""}`}>{settings.logos !== false && <Check size={13} strokeWidth={3} />}</span>
            <span>Firmen- und Coin-Logos laden (parqet.com und clearbit.com sehen dabei deine Ticker)</span>
          </button>
          <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
            <Btn kind="ghost" onClick={exportData} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Download size={16} strokeWidth={1.75} /> Backup exportieren
            </Btn>
            <Btn kind="ghost" onClick={() => importRef.current && importRef.current.click()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Upload size={16} strokeWidth={1.75} /> Backup importieren
            </Btn>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json,text/plain,*/*"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) importData(f); e.target.value = ""; }}
            />
          </div>
          <CheckRow on={exportKeys} onToggle={() => setExportKeys((v) => !v)}>API-Keys ins Backup aufnehmen</CheckRow>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: C.muted }}>
            Deine Daten liegen ausschliesslich lokal auf diesem Gerät (Browser-Speicher) – kein Server, kein Konto.
            Das Backup enthält alle Einträge, das Steuerprofil und die Einstellungen – ohne App-Sperre und, solange das Häkchen oben fehlt, ohne API-Keys.
            Nach aussen gehen nur Ticker bzw. ISIN/WKN an die Kursdienste (CoinGecko, Finnhub, Twelve Data, gold-api, onvista), Währungspaare an die Wechselkursdienste (frankfurter.dev, er-api) und – falls aktiviert – Ticker an die Logo-Dienste.
          </div>
          <Field label="App-Version">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{APP_VERSION}</span>
              <Btn kind="ghost" small onClick={checkForUpdate} style={{ gap: 6, flex: "none" }}>
                <RefreshCw size={15} strokeWidth={1.9} /> Aktualisieren
              </Btn>
            </div>
          </Field>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: C.muted, marginTop: -6 }}>
            Updates kommen automatisch. Falls die App eine alte Fassung zeigt, hier tippen – das leert den Zwischenspeicher und lädt neu. Deine Daten bleiben erhalten.
          </div>
          </Card>
        </>
      )}

      {/* ---------- Rückgängig-Leiste ---------- */}
      {undo && (
        <div className={`fc-undo ${sheet ? "top" : ""}`}>
          <div className="fc-undo-inner">
            <span className="txt">{undo.label}</span>
            <button onClick={doUndo}>Rückgängig</button>
          </div>
        </div>
      )}
      {toast && (
        <div key={toast.id} className={`fc-toast ${sheet ? "top" : undo ? "lift" : ""}`} role="status" aria-live="polite" onClick={() => setToast(null)}>
          <div className="fc-toast-inner">{toast.text}</div>
        </div>
      )}

      {/* ---------- Tab-Bar ---------- */}
      <nav className="fc-tabs" aria-label="Bereiche">
        <div className="fc-tabs-inner">
          {[
            { id: "home", label: "Übersicht", ic: LayoutGrid },
            { id: "income", label: "Einnahmen", ic: Wallet },
            { id: "expenses", label: "Kosten", ic: Receipt },
            { id: "credits", label: "Kredite", ic: Landmark },
            { id: "invest", label: "Invest", ic: TrendingUp },
            { id: "profil", label: "Profil", ic: User },
          ].map((t) => (
            <button key={t.id} type="button" className={`fc-tab ${tab === t.id ? "active" : ""}`} aria-current={tab === t.id ? "page" : undefined} onClick={() => { setTab(t.id); setSheet(null); setSearch(""); }}>
              <span className="ic" aria-hidden><t.ic size={20} strokeWidth={1.75} /></span>
              {t.label}
              <span className="u" aria-hidden />
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
