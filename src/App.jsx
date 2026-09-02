import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, Sector, CartesianGrid } from "recharts";
import {
  Home, LayoutGrid, Receipt, TrendingUp, Download, Upload, Wallet, Landmark, Coins, Banknote,
  Sun, Moon, Monitor, Gem, Eye, EyeOff, Fingerprint, Lock, PiggyBank, Check,
  Tag, ArrowDownWideNarrow, Layers, RefreshCw, Calculator, User, Percent,
} from "lucide-react";
import {
  C, SHADOW, MASK, CURRENCIES, VALUE_TYPES, HIST_TYPES, SAVE_CAT, INCOME_TYPES, INCOME_ICONS, ALL_CAT_ICONS,
  COMMODITIES, CRYPTO_IDS, CAT_COLORS, APP_VERSION, catsOf,
} from "./lib/constants.jsx";
import { CAN_HOVER, uid, agoLabel, todayIso, isoDay, addDays, daysBetween } from "./lib/utils.js";
import { getCur, setCurrency, locale, curSym, eur, eurFull, money, fmtQty, fmtDay, roundPrice } from "./lib/currency.js";
import { fetchFx } from "./lib/api.js";
import { bioAvailable, bioRegister, bioVerify, sessionUnlocked, markUnlocked, clearUnlocked } from "./lib/auth.js";
import {
  monthsUntil, applyDueCredits, gkeyOf, fifoAt, cashAmount, cashAtDate, propValueAt,
  buildGroups, monthly, histKeyOf,
} from "./lib/finance.js";
import { BUNDESLAENDER, blOf } from "./lib/tax.js";
import {
  DATA_KEY, SETTINGS_KEY, MASKED_KEY, EMPTY, DEFAULT_SETTINGS, loadLS, saveLS, loadHist, saveHist,
  parseBackup, buildBackup, normalizeSettings,
} from "./lib/storage.js";
import { DEMO } from "./data/demo.js";
import {
  Card, SectionTitle, Empty, Btn, SearchBar, NumInput, Field, YearTag, Sub, Lead, AssetLogo, Sheet, ListItem, CashflowBar,
} from "./components/ui.jsx";
import {
  IncomeForm, ExpenseForm, CreditForm, InvestForm, CatManager, GoalForm, AmountForm, DivForm, CashDetail,
  ExtraPaymentForm, CreditDetail, SellForm, AssetDetail,
} from "./components/forms.jsx";

/* Schwere Sheets erst laden, wenn sie geöffnet werden (Code-Splitting) */
const PortfolioChart = lazy(() => import("./features/PortfolioChart.jsx"));
const AmortView = lazy(() => import("./features/AmortView.jsx"));
const ForecastView = lazy(() => import("./features/ForecastView.jsx"));
const PropertyCalculator = lazy(() => import("./features/PropertyCalculator.jsx"));
const Loading = () => <div className="fc-chart-empty" style={{ height: 120 }}>Wird geladen …</div>;

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
  const CUR = getCur();
  /* Immer aktueller Datenstand für Undo (unabhängig vom Render-Zyklus) */
  const dataRef = useRef(data);
  dataRef.current = data;
  const [tab, setTab] = useState("home");
  const [costView, setCostView] = useState("fix");
  /* Sortierung der Positionsliste liegt in den Settings, damit sie erhalten bleibt */
  const investSort = ["size", "type", "day"].includes(settings.investSort) ? settings.investSort : "size";
  const setInvestSort = (v) => setSettings((x) => ({ ...x, investSort: v }));
  const [sheet, setSheet] = useState(null);
  const [priceStatus, setPriceStatus] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceFailIds, setPriceFailIds] = useState([]);
  const [activeCat, setActiveCat] = useState(-1);
  const [hoverCat, setHoverCat] = useState(-1);
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
  const [fxRates, setFxRates] = useState({ EUR: 1, USD: 1, CHF: 1 });
  const importRef = useRef(null);

  /* Wechselkurse für Cash-Konten in Fremdwährung (1 Einheit → Anzeigewährung) */
  useEffect(() => {
    let dead = false;
    (async () => {
      const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
      const others = CURRENCIES.filter((c) => c !== cur);
      const next = { [cur]: 1 };
      for (const c of others) {
        const r = await fetchFx(c, cur);
        next[c] = r > 0 ? r : 1;
      }
      if (!dead) setFxRates(next);
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

  /* Kurshistorie: einmal aus IndexedDB laden, danach im State halten (Finding 7/11) */
  const [hist, setHist] = useState({});
  const [histReady, setHistReady] = useState(false);
  useEffect(() => { let dead = false; loadHist().then((h) => { if (!dead) { setHist(h || {}); setHistReady(true); } }); return () => { dead = true; }; }, []);
  const updateHist = async (h) => { setHist({ ...h }); const ok = await saveHist(h); if (!ok) setPriceStatus("Kurshistorie konnte nicht gespeichert werden (Speicher voll)"); };

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
  const incomeTotal = useMemo(() => data.incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0), [data.incomes]);
  const fixTotal = useMemo(() => data.expenses.filter((e) => e.kind !== "variabel" && e.kind !== "sparen").reduce((s, e) => s + monthly(e), 0), [data.expenses]);
  const varTotal = useMemo(() => data.expenses.filter((e) => e.kind === "variabel").reduce((s, e) => s + monthly(e), 0), [data.expenses]);
  const savingsTotal = useMemo(() => data.expenses.filter((e) => e.kind === "sparen").reduce((s, e) => s + monthly(e), 0), [data.expenses]);
  const costTotal = fixTotal + varTotal;
  const budgetMode = settings.calcMode === "budget";
  const creditRate = useMemo(() => data.credits.reduce((s, c) => s + (Number(c.rate) || 0), 0), [data.credits]);
  const creditBalance = useMemo(() => data.credits.reduce((s, c) => s + (Number(c.balance) || 0), 0), [data.credits]);
  const extraTotal = useMemo(
    () => data.credits.reduce((s, c) => s + (c.extras || []).reduce((a, e) => a + (Number(e.amt) || 0), 0), 0),
    [data.credits],
  );
  const surplus = incomeTotal - costTotal - creditRate;
  /* Budget-Modus: was nach Fixkosten, Krediten und Sparrate für variable Ausgaben bleibt */
  const budgetTotal = incomeTotal - fixTotal - creditRate - savingsTotal;
  const budgetFree = budgetTotal - varTotal;

  /* Kategorien: eingebaute + eigene, inklusive Umbenennungen */
  const fixCats = useMemo(() => catsOf("fix", data), [data.cats, data.catNames]);
  const varCats = useMemo(() => catsOf("variabel", data), [data.cats, data.catNames]);
  const allCats = useMemo(() => [...fixCats, ...varCats, SAVE_CAT], [fixCats, varCats]);
  const catCounts = useMemo(() => {
    const m = {};
    for (const e of data.expenses) m[e.category] = (m[e.category] || 0) + 1;
    return m;
  }, [data.expenses]);

  const catTotals = useMemo(() =>
    allCats.map((c) => ({
      ...c,
      value: data.expenses.filter((e) => e.category === c.id && e.kind !== "sparen").reduce((s, e) => s + monthly(e), 0),
    })).filter((c) => c.value > 0),
  [data.expenses, allCats]);

  const catSum = useMemo(() => catTotals.reduce((a, c) => a + c.value, 0), [catTotals]);
  /* Auswahl (Tap) hat Vorrang, Hover nur als Vorschau auf Desktop */
  const shownCat = activeCat >= 0 && activeCat < catTotals.length
    ? activeCat
    : (hoverCat >= 0 && hoverCat < catTotals.length ? hoverCat : -1);
  const shownCatData = shownCat >= 0 ? catTotals[shownCat] : null;
  const centerVal = masked ? MASK : eurFull(shownCatData ? shownCatData.value : catSum);
  /* Sehr lange Betraege werden kleiner gesetzt, damit sie nie an den Innenring stossen */
  const centerValSize = centerVal.length > 13 ? 14 : centerVal.length > 11 ? 15 : 17;

  /* Verträge, deren Kündigung in den nächsten 60 Tagen fällig wird */
  const dueContracts = useMemo(() => {
    const today = todayIso();
    return data.expenses
      .filter((e) => e.until && e.kind !== "variabel")
      .map((e) => {
        const notice = Number(e.notice) || 0;
        const end = new Date(e.until);
        const deadline = isoDay(new Date(end.getFullYear(), end.getMonth() - notice, end.getDate()));
        return { ...e, deadline, days: daysBetween(today, deadline) };
      })
      .filter((e) => e.days <= 60)
      .sort((a, b) => a.days - b.days);
  }, [data.expenses]);

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
    if (r.dayPctAt && Date.now() - r.dayPctAt > 36 * 3600 * 1000) return null;
    return r.dayPct;
  };
  const portfolioValue = useMemo(() => groups.reduce((s, g) => s + g.value, 0), [groups]);
  const portfolioCost = useMemo(() => groups.reduce((s, g) => s + g.cost, 0), [groups]);
  const realizedTotal = useMemo(() => groups.reduce((s, g) => s + g.realized, 0), [groups]);
  const gain = portfolioValue - portfolioCost + realizedTotal;
  const netWorth = portfolioValue - creditBalance;
  /* Cash in Anzeigewährung – Basis für Sondertilgung aus Cash */
  const cashInCur = useMemo(() => {
    const c = data.investments.find((x) => x.type === "cash" && (x.ccy || CUR) === CUR);
    return c ? cashAmount(c) : 0;
  }, [data.investments, settings.currency]);
  const divTotal12 = useMemo(() => {
    const cut = addDays(todayIso(), -365);
    return (data.divs || []).filter((x) => (x.date || "") >= cut).reduce((s, x) => s + (Number(x.amt) || 0), 0);
  }, [data.divs]);
  const lastPriceUpdate = useMemo(() => {
    const ts = data.investments.map((i) => i.priceUpdated || 0);
    return ts.length ? Math.max(...ts) : 0;
  }, [data.investments]);

  /* ---------- Monats-Snapshots & Vermögensverlauf ----------
     Der Verlauf wird NICHT aus eingefrorenen Netto-Werten gezeichnet, sondern
     je Monat aus den Bausteinen rekonstruiert:
       • Cash: exakter Stand am Stichtag (Zuflüsse an ihrem Tag) – kein Zins.
       • Aktien/ETF/Krypto: historische Kurse (wie im Invest-Chart).
       • Immobilie: Kaufpreis + AKTUELLE Rate ab Kaufdatum – aendert man die
         Rate, wird der ganze Verlauf mit der neuen Rate gerechnet (0 % = flach).
       • Kredite: Restschuld je Monat (Tilgung ist darin schon berücksichtigt).
     Gespeichert wird zusaetzlich `sx` = Vermögen OHNE Immobilie (Aktien+Cash−
     Schulden); es ist von der Rate unabhaengig. Fuer aeltere Snapshots ohne `sx`
     wird der Nicht-Immobilien-Teil aus Cash/Restschuld rekonstruiert (sofern
     keine Wertpapiere im Spiel sind), sonst behutsam aus dem Altwert. */
  const cashGroupsNV = groups.filter((g) => g.type === "cash");
  const propGroupsNV = groups.filter((g) => g.type === "immobilie");
  const stockGroupsNV = groups.filter((g) => HIST_TYPES.includes(g.type));
  const monthRef = (m) => {
    if (m === monthKey) return todayIso();
    const [y, mm] = m.split("-").map(Number);
    const last = new Date(y, mm, 0).getDate();
    return `${m}-${String(last).padStart(2, "0")}`;
  };
  const cashSumAt = (d) => cashGroupsNV.reduce((s, g) => s + cashAtDate(g.ref, d) * (fxRates[g.ref.ccy || CUR] || 1), 0);
  const propSumAt = (d) => propGroupsNV.reduce((s, g) => (g.ref.buyDate && g.ref.buyDate > d) ? s : s + propValueAt(g.ref, d), 0);
  /* Wertpapier-Wert an einem Stichtag aus der Kurshistorie (letzter Kurs ≤ d).
     Fehlt Historie fuer eine Position, gilt ersatzweise ihr aktueller Kurs. */
  const histNV = hist;
  const priceLE = (series, d) => {
    let best = null;
    for (const k in series) { if (k <= d && (best === null || k > best)) best = k; }
    return best === null ? null : series[best];
  };
  const stockSumAt = (d) => stockGroupsNV.reduce((sum, g) => {
    const pos = fifoAt(g.lots, g.sells, d);
    if (pos.openQty <= 1e-9) return sum;
    const h = histNV[histKeyOf(g, CUR)];
    let px = h && h.series ? priceLE(h.series, d) : null;
    let rate = h && h.ccy && h.ccy !== CUR ? (fxRates[h.ccy] || 1) : 1;
    if (px == null) { px = Number(g.price) || 0; rate = 1; }
    return sum + pos.openQty * px * rate;
  }, 0);

  const monthKey = new Date().toISOString().slice(0, 7);
  useEffect(() => {
    if (!data.incomes.length && !data.expenses.length && !data.credits.length && !data.investments.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Monats-Snapshot ist abgeleiteter, persistierter Zustand
    setData((d) => {
      const snaps = d.snapshots || [];
      const cur = snaps.find((s) => s.m === monthKey);
      const next = { m: monthKey, net: Math.round(netWorth), pf: Math.round(portfolioValue), debt: Math.round(creditBalance) };
      if (cur && cur.net === next.net && cur.pf === next.pf && cur.debt === next.debt) return d;
      return { ...d, snapshots: [...snaps.filter((s) => s.m !== monthKey), next].sort((a, b) => a.m.localeCompare(b.m)).slice(-120) };
    });
  }, [netWorth, portfolioValue, creditBalance, monthKey]);

  const snapshots = data.snapshots || [];
  /* Nettovermögen eines Monats KOMPLETT neu berechnet (nie ein gecachter Wert):
     Cash (exakt) + Wertpapiere (Kurshistorie) + Immobilie (aktuelle Rate ab
     Kauf) − Restschuld des Monats. Der laufende Monat nutzt den Live-Wert. */
  const nvAt = (s) => (s.m === monthKey
    ? netWorth
    : cashSumAt(monthRef(s.m)) + stockSumAt(monthRef(s.m)) + propSumAt(monthRef(s.m)) - (Number(s.debt) || 0));
  /* Verlaufs-Chart: immer die letzten 3 Monate, jeder Punkt frisch rekonstruiert.
     Restschuld je Monat aus dem Snapshot (sonst aktuelle Restschuld). */
  const wealthSeries = (() => {
    const base = new Date();
    const out = [];
    for (let k = 2; k >= 0; k--) {
      const dt = new Date(base.getFullYear(), base.getMonth() - k, 1);
      const m = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const snap = snapshots.find((s) => s.m === m);
      const debt = snap ? (Number(snap.debt) || 0) : Math.round(creditBalance);
      const d = monthRef(m);
      const net = m === monthKey ? Math.round(netWorth) : Math.round(cashSumAt(d) + stockSumAt(d) + propSumAt(d) - debt);
      out.push({ m, net });
    }
    return out;
  })();
  /* Y-Achse eng an den Werteverlauf legen, damit die Entwicklung sichtbar ist. */
  const yLo = Math.min(...wealthSeries.map((p) => p.net));
  const yHi = Math.max(...wealthSeries.map((p) => p.net));
  const yPad = Math.max((yHi - yLo) * 0.18, Math.abs(yHi) * 0.02, 1);
  const yDomain = [Math.round(yLo - yPad), Math.round(yHi + yPad)];
  /* Veränderung gegenüber dem letzten abgeschlossenen Monat (gleiche Rechnung
     fuer beide Monate -> eine Ratenaenderung zaehlt nie als Verlust). */
  const lastMonthSnap = useMemo(() => {
    const prev = snapshots.filter((s) => s.m < monthKey);
    return prev.length ? prev[prev.length - 1] : null;
  }, [snapshots, monthKey]);
  const netDelta = lastMonthSnap ? netWorth - nvAt(lastMonthSnap) : null;
  const monthName = (m) => {
    const [y, mm] = m.split("-");
    return `${["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."][Number(mm) - 1]} ${y.slice(2)}`;
  };

  /* CRUD */
  const save = (key, item) => {
    setData((d) => {
      const list = d[key];
      const exists = item.id && list.some((x) => x.id === item.id);
      return { ...d, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, { ...item, id: uid() }] };
    });
    setSheet(null);
  };
  /* Löschen ohne Rückfrage, dafür 8 Sekunden Rückgängig-Leiste */
  const undoTimer = useRef(null);
  function withUndo(label, mutate) {
    /* Zustand vor der Änderung sichern – ausserhalb des Updaters, damit er
       auch bei mehrfach ausgeführten Updates unverändert bleibt */
    const before = dataRef.current;
    setUndo({ label, before });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
    const next = mutate(before);
    dataRef.current = next;
    setData(next);
  }
  function doUndo() {
    if (!undo) return;
    const before = undo.before;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setData(before);
  }
  const remove = (key, id) => {
    const item = (data[key] || []).find((x) => x.id === id);
    withUndo(`${item && item.name ? item.name : "Eintrag"} gelöscht`, (d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) }));
  };

  /* ---------- Verkäufe (FIFO) und Cash ---------- */
  /* Erlös landet automatisch auf dem Cash-Konto in der Anzeigewährung */
  function bookSell(gkey, s) {
    const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
    const sellId = uid();
    const date = s.date || todayIso();
    const proceeds = (Number(s.qty) || 0) * (Number(s.price) || 0);
    setData((d) => {
      const sells = [...(d.sells || []), { id: sellId, gkey, qty: Number(s.qty) || 0, price: Number(s.price) || 0, date }];
      const flow = { id: sellId, d: date, amt: proceeds };
      const idx = d.investments.findIndex((x) => x.type === "cash" && (x.ccy || cur) === cur);
      let investments;
      if (idx >= 0) {
        investments = d.investments.map((x, k) => {
          if (k !== idx) return x;
          const amt = (Number(x.price) || 0) + proceeds;
          return { ...x, price: amt, buyPrice: amt, flows: [...(x.flows || []), flow] };
        });
      } else {
        investments = [...d.investments, {
          id: uid(), type: "cash", name: `Cash ${cur}`, ccy: cur, symbol: "",
          qty: 1, price: proceeds, buyPrice: proceeds, inChart: true, flows: [flow],
        }];
      }
      return { ...d, sells, investments };
    });
    setSheet(null);
  }

  /* Verkauf zurücknehmen: Erlös wieder aus dem Cash-Konto herausrechnen */
  function removeSell(id) {
    withUndo("Verkauf gelöscht", (d) => {
      const s = (d.sells || []).find((x) => x.id === id);
      if (!s) return d;
      const amt = (Number(s.qty) || 0) * (Number(s.price) || 0);
      const investments = d.investments.map((x) => {
        if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === id)) return x;
        const rest = (Number(x.price) || 0) - amt;
        return { ...x, price: rest, buyPrice: rest, flows: x.flows.filter((f) => f.id !== id) };
      });
      return { ...d, sells: d.sells.filter((x) => x.id !== id), investments };
    });
  }

  /* ---------- Kategorien ---------- */
  function addCat(label, kind) {
    const id = `c_${uid()}`;
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
      return { ...d, goals: exists ? list.map((x) => (x.id === g.id ? g : x)) : [...list, { ...g, id: uid() }] };
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

  /* ---------- Dividenden / Zinserträge ---------- */
  function bookDiv(gkey, v) {
    const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
    const id = uid();
    const date = v.date || todayIso();
    const amt = Number(v.amt) || 0;
    setData((d) => {
      const divs = [...(d.divs || []), { id, gkey, amt, date }];
      let investments = d.investments;
      if (v.toCash) {
        const flow = { id, d: date, amt };
        const idx = investments.findIndex((x) => x.type === "cash" && (x.ccy || cur) === cur);
        if (idx >= 0) {
          investments = investments.map((x, k) => {
            if (k !== idx) return x;
            const n = (Number(x.price) || 0) + amt;
            return { ...x, price: n, buyPrice: n, flows: [...(x.flows || []), flow] };
          });
        } else {
          investments = [...investments, { id: uid(), type: "cash", name: `Cash ${cur}`, ccy: cur, symbol: "", qty: 1, price: amt, buyPrice: amt, inChart: true, flows: [flow] }];
        }
      }
      return { ...d, divs, investments };
    });
    setSheet({ type: "group", gkey });
  }
  function removeDiv(id) {
    withUndo("Ausschüttung gelöscht", (d) => ({
      ...d,
      divs: (d.divs || []).filter((x) => x.id !== id),
      investments: d.investments.map((x) => {
        if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === id)) return x;
        const back = (x.flows.find((f) => f.id === id) || {}).amt || 0;
        const rest = (Number(x.price) || 0) - back;
        return { ...x, price: rest, buyPrice: rest, flows: x.flows.filter((f) => f.id !== id) };
      }),
    }));
  }

  /* ---------- Cash-Bewegungen ---------- */
  function bookCashFlow(cashId, amt, date, label) {
    setData((d) => ({
      ...d,
      investments: d.investments.map((x) => {
        if (x.id !== cashId) return x;
        const n = Math.max(0, (Number(x.price) || 0) + amt);
        return { ...x, price: n, buyPrice: n, flows: [...(x.flows || []), { id: uid(), d: date || todayIso(), amt, label }] };
      }),
    }));
    setSheet({ type: "cash", id: cashId });
  }
  function removeCashFlow(cashId, flowId) {
    withUndo("Buchung gelöscht", (d) => ({
      ...d,
      investments: d.investments.map((x) => {
        if (x.id !== cashId) return x;
        const fl = (x.flows || []).find((f) => f.id === flowId);
        if (!fl) return x;
        const n = Math.max(0, (Number(x.price) || 0) - (Number(fl.amt) || 0));
        return { ...x, price: n, buyPrice: n, flows: x.flows.filter((f) => f.id !== flowId) };
      }),
    }));
  }

  /* ---------- Sondertilgungen ---------- */
  function bookExtra(creditId, e) {
    const amt = Number(e.amt) || 0;
    const exId = uid();
    const date = e.date || todayIso();
    const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
    setData((d) => {
      const credits = d.credits.map((c) => {
        if (c.id !== creditId) return c;
        const bal = Math.max(0, (Number(c.balance) || 0) - amt);
        return { ...c, balance: Math.round(bal * 100) / 100, extras: [...(c.extras || []), { id: exId, d: date, amt, fromCash: !!e.fromCash }] };
      });
      let investments = d.investments;
      if (e.fromCash) {
        const idx = investments.findIndex((x) => x.type === "cash" && (x.ccy || cur) === cur);
        if (idx >= 0) {
          investments = investments.map((x, k) => {
            if (k !== idx) return x;
            const n = Math.max(0, (Number(x.price) || 0) - amt);
            return { ...x, price: n, buyPrice: n, flows: [...(x.flows || []), { id: exId, d: date, amt: -amt, label: "Sondertilgung" }] };
          });
        }
      }
      return { ...d, credits, investments };
    });
    setSheet({ type: "creditDetail", id: creditId });
  }
  function removeExtra(creditId, extraId) {
    withUndo("Sondertilgung gelöscht", (d) => ({
      ...d,
      credits: d.credits.map((c) => {
        if (c.id !== creditId) return c;
        const ex = (c.extras || []).find((x) => x.id === extraId);
        if (!ex) return c;
        const bal = (Number(c.balance) || 0) + (Number(ex.amt) || 0);
        /* Falls die Tilgung vom Cash-Konto kam, den Betrag dort zurückbuchen */
        return { ...c, balance: Math.round(bal * 100) / 100, extras: c.extras.filter((x) => x.id !== extraId) };
      }),
      investments: d.investments.map((x) => {
        if (x.type !== "cash" || !(x.flows || []).some((f) => f.id === extraId)) return x;
        const back = (x.flows.find((f) => f.id === extraId) || {}).amt || 0;
        const rest = (Number(x.price) || 0) - back;
        return { ...x, price: rest, buyPrice: rest, flows: x.flows.filter((f) => f.id !== extraId) };
      }),
    }));
  }

  /* Ganze Gruppe löschen: alle Käufe und Verkäufe des Assets */
  function removeGroup(gkey) {
    const g = groups.find((x) => x.gkey === gkey);
    withUndo(`${g ? g.name : "Position"} gelöscht`, (d) => ({
      ...d,
      investments: d.investments.filter((x) => gkeyOf(x) !== gkey),
      sells: (d.sells || []).filter((x) => x.gkey !== gkey),
      divs: (d.divs || []).filter((x) => x.gkey !== gkey),
    }));
  }

  /* Kurse beim Öffnen des Invest-Reiters automatisch nachladen (max. alle 6 Stunden) */
  const autoFetched = useRef(false);
  useEffect(() => {
    if (tab !== "invest" || autoFetched.current) return;
    const stale = !lastPriceUpdate || Date.now() - lastPriceUpdate > 6 * 3600000;
    const priceable = data.investments.some((i) => !VALUE_TYPES.includes(i.type));
    if (stale && priceable) { autoFetched.current = true; refreshPrices(); }
  }, [tab, lastPriceUpdate, data.investments]);

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
      if (fire && !priceBusy) refreshPrices();
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
  }, [sheet, locked, priceBusy, data.investments]);

  /* ---------- Live-Kurse: CoinGecko (Krypto) + Finnhub (Aktien/ETF) ---------- */
  async function refreshPrices() {
    const priceable = data.investments.filter((i) => !VALUE_TYPES.includes(i.type));
    if (!priceable.length) return;
    setPriceBusy(true);
    const notes = [];
    const failed = [];
    const updated = {};   // symbol → price
    const updatedById = {}; // item.id → price (Rohstoffe, TD-Treffer)
    const dayPct = {};      // symbol → Tagesveränderung in %
    const dayPctById = {};  // item.id → Tagesveränderung in %
    const resolved = {};  // symbol → coinId (für künftige Updates cachen)
    const cur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
    const curLow = cur.toLowerCase();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /* Krypto → CoinGecko (kostenlos, ohne Key, direkt in der gewählten Währung) */
    const cryptos = priceable.filter((i) => i.type === "krypto");
    if (cryptos.length) {
      const symToId = {};
      for (const c of cryptos) {
        const s = (c.symbol || "").toUpperCase();
        let id = c.coinId || CRYPTO_IDS[s];
        if (!id) {
          try {
            const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(s)}`);
            if (r.status === 429) { notes.push("CoinGecko-Limit erreicht – in 1 Min. erneut versuchen"); break; }
            const j = await r.json();
            id = ((j.coins || []).find((x) => (x.symbol || "").toUpperCase() === s) || {}).id;
            await sleep(400); /* Rate-Limit schonen */
          } catch { /* unten als failed markiert */ }
        }
        if (id) { symToId[s] = id; resolved[s] = id; }
        else failed.push(s);
      }
      const ids = Object.values(symToId);
      if (ids.length) {
        try {
          const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${curLow}&include_24hr_change=true`);
          if (r.status === 429) {
            notes.push("CoinGecko-Limit erreicht – in 1 Min. erneut versuchen");
          } else {
            const j = await r.json();
            for (const [s, id] of Object.entries(symToId)) {
              const p = j[id] && j[id][curLow];
              const ch = j[id] && j[id][`${curLow}_24h_change`];
              if (p) { updated[s] = p; if (typeof ch === "number" && isFinite(ch)) dayPct[s] = ch; }
              else failed.push(s);
            }
          }
        } catch {
          notes.push("CoinGecko nicht erreichbar");
        }
      }
    }

    /* Aktien/ETF → zuerst Finnhub (US, USD). Nicht Gefundenes → Twelve Data */
    const stocks = priceable.filter((i) => i.type === "aktie" || i.type === "etf");
    const tdRetry = [];
    if (stocks.length) {
      if (settings.finnhubKey) {
        const usdEur = await fetchFx("USD", cur);
        if (!usdEur) {
          notes.push("Wechselkurs nicht erreichbar – Aktien übersprungen");
        } else {
          let keyInvalid = false;
          for (const s of stocks) {
            const sym = (s.symbol || "").toUpperCase();
            try {
              const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${settings.finnhubKey}`);
              if (res.status === 401 || res.status === 403) { keyInvalid = true; break; }
              if (res.status === 429) { notes.push("Finnhub-Limit erreicht – in 1 Min. erneut versuchen"); break; }
              const q = await res.json();
              if (q && q.c) {
                updated[sym] = q.c * usdEur;
                if (typeof q.dp === "number" && isFinite(q.dp)) dayPct[sym] = q.dp;
              }
              else tdRetry.push(s);
              await sleep(250);
            } catch { tdRetry.push(s); }
          }
          if (keyInvalid) { notes.push("Finnhub-Key ungültig – bitte in den Einstellungen prüfen"); }
        }
      } else {
        tdRetry.push(...stocks);
      }
    }

    /* Edelmetalle → gold-api (USD/Unze, ohne Key) + Umrechnung */
    const metals = priceable.filter((i) => i.type === "rohstoff" && (COMMODITIES.find((c) => c.id === i.commodity) || {}).src === "metal");
    if (metals.length) {
      const fx = await fetchFx("USD", cur);
      if (!fx) { notes.push("Wechselkurs nicht erreichbar – Edelmetalle übersprungen"); }
      else {
        for (const m of metals) {
          const def = COMMODITIES.find((c) => c.id === m.commodity);
          try {
            const j = await fetch(`https://api.gold-api.com/price/${def.sym}`).then((r) => r.json());
            if (j && j.price) updatedById[m.id] = j.price * fx;
            else failed.push(m.name);
          } catch { failed.push(m.name); }
        }
      }
    }

    /* Twelve Data → EU-/nicht-US-Aktien, ETFs (per Ticker oder ISIN) und Öl */
    const tdCommods = priceable.filter((i) => i.type === "rohstoff" && (COMMODITIES.find((c) => c.id === i.commodity) || {}).src === "td");
    if (tdRetry.length || tdCommods.length) {
      if (!settings.tdKey) {
        if (tdRetry.length) notes.push("Für EU-Aktien/ETFs & Öl: Twelve-Data-Key in den Einstellungen hinterlegen");
        else if (tdCommods.length) notes.push("Für Öl: Twelve-Data-Key in den Einstellungen hinterlegen");
      } else {
        const fxCache = {};
        const fxTo = async (ccy) => { if (!ccy) return 0; if (ccy === cur) return 1; if (fxCache[ccy] != null) return fxCache[ccy]; const r = await fetchFx(ccy, cur); fxCache[ccy] = r; return r; };
        for (const s of tdRetry) {
          const sym = (s.symbol || "").trim();
          try {
            const q = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${settings.tdKey}`).then((r) => r.json());
            const px = q && q.close != null ? Number(q.close) : null;
            if (px && q.currency) {
              const r = await fxTo(q.currency);
              if (r) {
                updated[sym.toUpperCase()] = px * r;
                const ch = Number(q.percent_change);
                if (isFinite(ch)) dayPct[sym.toUpperCase()] = ch;
              } else failed.push(sym);
            }
            else if (q && q.code === 429) { notes.push("Twelve-Data-Limit erreicht – in 1 Min. erneut versuchen"); break; }
            else if (q && /Grow|Venture/i.test(q.message || "")) failed.push(`${sym} (EU-Börse nur im kostenpflichtigen Plan)`);
            else failed.push(`${sym} (nicht gefunden)`);
            await sleep(350);
          } catch { failed.push(sym); }
        }
        for (const m of tdCommods) {
          const def = COMMODITIES.find((c) => c.id === m.commodity);
          try {
            const q = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(def.sym)}&apikey=${settings.tdKey}`).then((r) => r.json());
            const px = q && q.close != null ? Number(q.close) : null;
            const ccy = (q && q.currency) || "USD";
            if (px) {
              const r = await fxTo(ccy);
              if (r) {
                updatedById[m.id] = px * r;
                const ch = Number(q.percent_change);
                if (isFinite(ch)) dayPctById[m.id] = ch;
              } else failed.push(m.name);
            }
            else if (q && q.code === 429) { notes.push("Twelve-Data-Limit erreicht – in 1 Min. erneut versuchen"); break; }
            else if (q && /Grow|Venture/i.test(q.message || "")) failed.push(`${m.name} (nur im kostenpflichtigen Plan)`);
            else failed.push(m.name);
            await sleep(350);
          } catch { failed.push(m.name); }
        }
      }
    }

    if (Object.keys(updated).length || Object.keys(updatedById).length || Object.keys(resolved).length) {
      const now = Date.now();
      setData((d) => ({
        ...d,
        investments: d.investments.map((i) => {
          const sym = (i.symbol || "").toUpperCase();
          const p = updatedById[i.id] != null ? updatedById[i.id] : updated[sym];
          const coinId = resolved[sym] || i.coinId;
          const d = dayPctById[i.id] != null ? dayPctById[i.id] : dayPct[sym];
          if (p != null) {
            const next = { ...i, price: roundPrice(p), priceUpdated: now, coinId };
            if (d != null) { next.dayPct = Number(d.toFixed(2)); next.dayPctAt = now; }
            return next;
          }
          return coinId !== i.coinId ? { ...i, coinId } : i;
        }),
      }));
    }
    const failIds = priceable.filter((i) => {
      const sym = (i.symbol || "").toUpperCase();
      return updatedById[i.id] == null && updated[sym] == null;
    }).map((i) => i.id);
    setPriceFailIds(failIds);
    setTimeout(() => setPriceFailIds([]), 12000);
    const n = Object.keys(updated).length + Object.keys(updatedById).length;
    const parts = [];
    if (n) parts.push(`${n} von ${priceable.length} Kursen aktualisiert`);
    if (failed.length) parts.push(`Fehlgeschlagen: ${[...new Set(failed)].join(", ")}`);
    parts.push(...notes);
    if (parts.length) { setPriceStatus(parts.join(" · ")); setTimeout(() => setPriceStatus(""), 10000); }
    setPriceBusy(false);
  }

  /* Beim App-Start einmal automatisch aktualisieren */
  const didAutoRefresh = useRef(false);
  useEffect(() => {
    if (didAutoRefresh.current) return;
    didAutoRefresh.current = true;
    if (data.investments.some((i) => !VALUE_TYPES.includes(i.type))) {
      const t = setTimeout(() => refreshPrices(), 800);
      return () => clearTimeout(t);
    }
  }, []);

  /* ---------- Backup: Export / Import ---------- */
  const [exportKeys, setExportKeys] = useState(true);
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
    const flash = (msg) => { setPriceStatus(msg); setTimeout(() => setPriceStatus(""), 8000); };
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

      {(pullPx > 0 || priceBusy) && (
        <div
          className="fc-pull"
          style={{
            opacity: priceBusy ? 1 : Math.min(1, pullPx / 40),
            transform: `translateY(${priceBusy ? 14 : Math.max(4, pullPx - 12)}px)`,
          }}
        >
          <RefreshCw size={16} strokeWidth={2} className={priceBusy ? "spin" : ""} />
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

      {(priceStatus || saveErr) && (
        <div className="fc-status" role="status">
          {saveErr ? "Speichern fehlgeschlagen – Browser-Speicher voll? Bitte Backup exportieren." : priceStatus}
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
                {eurM(netWorth)}
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
            <div className="fc-kpi"><div className="l">Portfoliowert</div><div className="v">{eurM(portfolioValue)}</div></div>
          </div>

          {incomeTotal > 0 && (
            <>
              <SectionTitle>Wohin dein Geld fliesst</SectionTitle>
              <Card>
                <CashflowBar catTotals={catTotals} creditRate={creditRate} surplus={surplus} savings={savingsTotal} budgetFree={budgetFree} budgetMode={budgetMode} />
              </Card>
            </>
          )}

          {catTotals.length > 0 && (
            <>
              <SectionTitle>Ausgaben nach Kategorie</SectionTitle>
              <Card>
                <div style={{ position: "relative", width: "100%", height: 210 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={catTotals} dataKey="value" nameKey="label"
                        innerRadius={66} outerRadius={88} paddingAngle={3} stroke="none"
                        activeIndex={shownCat >= 0 ? shownCat : undefined}
                        activeShape={(p) => (
                          <g style={{ filter: "brightness(1.14) saturate(1.05)" }}>
                            <Sector {...p} outerRadius={p.outerRadius + 7} innerRadius={p.innerRadius - 2} cornerRadius={3} />
                          </g>
                        )}
                        onMouseEnter={CAN_HOVER ? (_, idx) => setHoverCat(idx) : undefined}
                        onMouseLeave={CAN_HOVER ? () => setHoverCat(-1) : undefined}
                        onClick={(_, idx) => { setHoverCat(-1); setActiveCat((p) => (p === idx ? -1 : idx)); }}
                        isAnimationActive={false}
                      >
                        {catTotals.map((c, i) => (
                          <Cell
                            key={c.id}
                            fill={c.color}
                            style={{ cursor: "pointer", opacity: shownCat < 0 || shownCat === i ? 1 : 0.42, transition: "opacity .15s" }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Betrag ist der fixe Anker: absolut in der Ringmitte verankert,
                     daher verschiebt ihn kein Text darueber oder darunter. */}
                  <div className="fc-pie-center">
                    <div className="vl" style={{ fontSize: centerValSize }}>{centerVal}</div>
                    <div className="sh">
                      {shownCatData && catSum > 0 ? `${Math.round((shownCatData.value / catSum) * 100)} %` : "pro Monat"}
                    </div>
                  </div>
                </div>

                {/* Kategoriename ausserhalb des Rings: volle Kartenbreite, feste Zeilenhoehe.
                   Damit kann der Name nie den Innenring beruehren und nichts springt. */}
                <div className="fc-pie-caption">
                  {shownCatData && <span className="dot" style={{ background: shownCatData.color }} />}
                  <span className="tx">{shownCatData ? shownCatData.label : "Gesamtausgaben – Kategorie antippen"}</span>
                </div>

              </Card>
            </>
          )}

          {dueContracts.length > 0 && (
            <>
              <SectionTitle>Kündigung fällig</SectionTitle>
              <Card>
                {dueContracts.slice(0, 4).map((e) => (
                  <div className="fc-warnrow" key={e.id}>
                    <span className="nm">{e.name}</span>
                    <span className="dt">
                      {e.days < 0 ? "Frist verstrichen" : e.days === 0 ? "heute" : `in ${e.days} T.`}
                    </span>
                    <button className="fc-chip" onClick={() => { setTab("expenses"); setCostView("fix"); setSheet({ type: "expense", item: e }); }}>Öffnen</button>
                  </div>
                ))}
                <div className="fc-detail-note" style={{ marginTop: 10 }}>
                  Kündigungsfrist läuft bis {fmtDay(dueContracts[0].deadline)} – Vertragsende {fmtDay(dueContracts[0].until)}.
                </div>
              </Card>
            </>
          )}

          {snapshots.length > 1 && (
            <>
              <SectionTitle right={<span className="fc-sum">{wealthSeries.length} Monate</span>}>Vermögensverlauf</SectionTitle>
              <Card>
                <div style={{ width: "100%", height: 190 }}>
                  <ResponsiveContainer>
                    <LineChart data={wealthSeries} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
                      <XAxis dataKey="m" tickFormatter={monthName} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} minTickGap={30} />
                      <YAxis domain={yDomain} width={58} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline}
                        tickFormatter={(v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} Mio` : Math.round(v).toLocaleString(locale()))} />
                      <Tooltip
                        labelFormatter={monthName}
                        formatter={(v) => [eurFull(v), "Nettovermögen"]}
                        contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 12.5, boxShadow: SHADOW }}
                        labelStyle={{ color: C.muted }}
                        itemStyle={{ color: C.ink }}
                      />
                      <Line type="monotone" dataKey="net" stroke={C.rausch} strokeWidth={2.4} dot={{ r: 3, fill: C.rausch, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
                  <div className="fc-item-main"><div className="fc-item-title">Gesamtvermögen</div><div className="fc-item-sub">{groups.length} Position(en)</div></div>
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
                  sub={INCOME_TYPES.find((t) => t.id === i.type)?.label}
                  value={eur(i.amount)}
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
          <div className="fc-seg" role="tablist">
            <button className={costView === "fix" ? "active" : ""} onClick={() => setCostView("fix")}>Fixkosten</button>
            <button className={costView === "variabel" ? "active" : ""} onClick={() => setCostView("variabel")}>Variabel</button>
          </div>
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
                const items = data.expenses.filter((e) => e.category === cat.id && e.kind !== "variabel" && matches(e.name, cat.label));
                if (!items.length) return null;
                return (
                  <React.Fragment key={cat.id}>
                    <SectionTitle right={<span className="fc-sum">{eur(items.reduce((s, e) => s + monthly(e), 0))} / Monat</span>}>{cat.label}</SectionTitle>
                    <Card>
                      {items.map((e) => (
                        <ListItem key={e.id}
                          lead={<Lead icon={ALL_CAT_ICONS[e.category] || Tag} />}
                          title={e.name}
                          tag={e.interval === "jaehrlich" ? <YearTag /> : null}
                          sub={<Sub parts={[
                            e.interval === "jaehrlich" ? `${eurFull(e.amount)} / Jahr` : "monatlich",
                            e.until ? `bis ${fmtDay(e.until)}` : null,
                          ]} />}
                          note={dueContracts.some((x) => x.id === e.id) ? `Kündigung bis ${fmtDay((dueContracts.find((x) => x.id === e.id) || {}).deadline)}` : null}
                          value={eur(monthly(e))}
                          onEdit={() => setSheet({ type: "expense", item: e })}
                          onDelete={() => remove("expenses", e.id)}
                        />
                      ))}
                    </Card>
                  </React.Fragment>
                );
              })}
              {data.expenses.filter((e) => e.kind !== "variabel" && e.kind !== "sparen").length === 0 && <div style={{ marginTop: 12 }}><Empty text="Erfasse Versicherungen, Miete, Abos und andere Fixkosten – monatlich oder jährlich." action={<Btn small onClick={() => setSheet({ type: "expense", kind: "fix" })}>Fixkosten hinzufügen</Btn>} /></div>}
              {budgetMode && (
                <>
                  <SectionTitle right={<span className="fc-sum">{eur(savingsTotal)} / Monat</span>}>{SAVE_CAT.label}</SectionTitle>
                  {data.expenses.filter((e) => e.kind === "sparen").length === 0
                    ? <Empty text="Lege fest, wie viel du jeden Monat fest zur Seite legst. Die Sparrate zählt nicht zu den Gesamtkosten." action={<Btn small onClick={() => setSheet({ type: "expense", kind: "sparen" })}>Sparrate festlegen</Btn>} />
                    : <Card>{data.expenses.filter((e) => e.kind === "sparen").map((e) => (
                        <ListItem key={e.id}
                          lead={<Lead icon={PiggyBank} />}
                          title={e.name}
                          tag={e.interval === "jaehrlich" ? <YearTag /> : null}
                          sub={e.interval === "jaehrlich" ? `${eurFull(e.amount)} / Jahr` : "monatlich"}
                          value={eur(monthly(e))}
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
                    <SectionTitle right={<span className="fc-sum">{eur(items.reduce((s, e) => s + monthly(e), 0))} / Monat</span>}>{cat.label}</SectionTitle>
                    <Card>
                      {items.map((e) => (
                        <ListItem key={e.id}
                          lead={<Lead icon={ALL_CAT_ICONS[e.category] || Tag} />}
                          title={e.name}
                          tag={e.interval === "jaehrlich" ? <YearTag /> : null}
                          sub={e.interval === "jaehrlich" ? `${eurFull(e.amount)} / Jahr` : "monatlich"}
                          value={eur(monthly(e))}
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
              <div className="v">{eurM(portfolioValue)}</div>
            </div>
            <div className="fc-kpi">
              <div className="l">Gewinn / Verlust</div>
              <div className="v" style={{ color: masked ? C.ink : gain >= 0 ? C.positive : C.error }}>{masked ? MASK : `${gain >= 0 ? "+" : ""}${eur(gain)}`}</div>
              {(realizedTotal !== 0 || divTotal12 > 0) && (
                <div style={{ fontSize: 12.5, marginTop: 3, color: C.muted }}>
                  {realizedTotal !== 0 && <>realisiert {masked ? MASK : `${realizedTotal >= 0 ? "+" : ""}${eur(realizedTotal)}`}</>}
                  {realizedTotal !== 0 && divTotal12 > 0 && " · "}
                  {divTotal12 > 0 && <>Ausschüttung {eurM(divTotal12)}</>}
                </div>
              )}
            </div>
          </div>
          {groups.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Suspense fallback={<Card><div className="fc-chart-empty" style={{ height: 236 }}>Chart wird geladen …</div></Card>}>
              <PortfolioChart
                groups={groups}
                hist={hist}
                histReady={histReady}
                onHist={updateHist}
                cur={CURRENCIES.includes(settings.currency) ? settings.currency : "EUR"}
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
              </Suspense>
            </div>
          )}
          {groups.length > 1 && (
            <div className="fc-invest-tools">
              <SearchBar value={search} onChange={setSearch} placeholder="Suchen" />
              <div className="fc-seg fc-seg-icons" role="tablist">
                <button className={investSort === "size" ? "active" : ""} onClick={() => setInvestSort("size")} title="Nach Grösse" aria-label="Nach Grösse sortieren">
                  <ArrowDownWideNarrow size={18} strokeWidth={1.7} />
                </button>
                <button className={investSort === "type" ? "active" : ""} onClick={() => setInvestSort("type")} title="Nach Art" aria-label="Nach Art sortieren">
                  <Layers size={18} strokeWidth={1.7} />
                </button>
                <button className={investSort === "day" ? "active" : ""} onClick={() => setInvestSort("day")} title="Nach Tagesveränderung" aria-label="Nach Tagesveränderung sortieren">
                  <Percent size={18} strokeWidth={1.7} />
                </button>
              </div>
            </div>
          )}
          {groups.length === 0
            ? <Empty text="Erfasse Aktien, ETFs und Krypto – der Ticker reicht, Name und Logo kommen automatisch. Auch Immobilien und Cash-Konten lassen sich als Position anlegen." action={<Btn small onClick={() => setSheet({ type: "invest" })}>Position hinzufügen</Btn>} />
            : <Card>{[...groups].filter((g) => matches(g.name, g.ref.symbol)).sort((a, b) => {
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
                const pct = showPct ? (g.unreal / g.cost) * 100 : 0;
                const subParts = isCash
                  ? (ccy !== CUR ? [masked ? MASK : money(cashAmount(g.ref), ccy), `Kurs ${(fxRates[ccy] || 1).toFixed(4).replace(".", ",")}`] : ["Cash-Konto"])
                  : g.type === "immobilie"
                    ? ["Immobilie"]
                    : g.qty > 0
                      ? [
                          `${fmtQty(g.qty)} ${g.type === "rohstoff" ? unit : "Stk"}`,
                          masked ? MASK : eur(g.price),
                          g.lots.length > 1 ? `${g.lots.length} Käufe` : null,
                          g.sells.length ? `${g.sells.length} verkauft` : null,
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
                    sub={<Sub parts={subParts} />}
                    value={
                      <span>
                        {eurM(g.value)}<br />
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
          <div style={{ margin: "0 16px", display: "flex", gap: 12 }}>
            <Btn onClick={() => setSheet({ type: "invest" })} style={{ flex: 1 }}>+ Position</Btn>
          </div>
          <div className="fc-hint">
            Zum Aktualisieren der Kurse die Seite nach unten ziehen{lastPriceUpdate > 0 ? ` – zuletzt ${agoLabel(lastPriceUpdate)}` : ""}.
            Krypto und Edelmetalle laufen ohne Key, Aktien und ETFs über die API-Keys in den Einstellungen.
          </div>
        </>
      )}

      {/* ---------- Sheets ---------- */}
      {sheet?.type === "income" && (
        <Sheet title={sheet.item ? "Einnahme bearbeiten" : "Neue Einnahme"} onClose={() => setSheet(null)}>
          <IncomeForm initial={sheet.item} onSave={(f) => save("incomes", f)} />
        </Sheet>
      )}
      {sheet?.type === "expense" && (
        <Sheet title={sheet.item ? ((sheet.item.kind === "sparen") ? "Sparrate bearbeiten" : "Ausgabe bearbeiten") : ((sheet.kind || "fix") === "variabel" ? "Neue variable Ausgabe" : (sheet.kind === "sparen" ? "Neue Sparrate" : "Neue Fixkosten"))} onClose={() => setSheet(null)}>
          <ExpenseForm
            initial={sheet.item}
            kind={sheet.kind}
            catList={((sheet.item && sheet.item.kind) || sheet.kind) === "variabel" ? varCats : fixCats}
            onAddCat={addCat}
            onSave={(f) => save("expenses", f)}
          />
        </Sheet>
      )}
      {sheet?.type === "forecast" && (
        <Sheet title="Prognose – Vermögensentwicklung" onClose={() => setSheet(null)}>
          <Suspense fallback={<Loading />}><ForecastView surplus={budgetMode ? savingsTotal : surplus} startValue={netWorth} /></Suspense>
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
            <Suspense fallback={<Loading />}><AmortView credit={c} /></Suspense>
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
          title={sheet.item ? "Kauf bearbeiten" : sheet.preset ? `${sheet.preset.name} zukaufen` : "Neue Position"}
          onClose={() => setSheet(sheet.back ? { type: "group", gkey: sheet.back } : sheet.backCash ? { type: "cash", id: sheet.backCash } : null)}
        >
          <InvestForm
            initial={sheet.item || sheet.preset}
            onSave={(f) => { save("investments", f); if (sheet.back) setSheet({ type: "group", gkey: sheet.back }); if (sheet.backCash) setSheet({ type: "cash", id: sheet.backCash }); }}
            finnhubKey={settings.finnhubKey}
          />
        </Sheet>
      )}
      {sheet?.type === "objektcheck" && (
        <Sheet title="Objekt-Check" onClose={() => setSheet(null)}>
          <Suspense fallback={<Loading />}>
            <PropertyCalculator
              settings={settings}
              fxRates={fxRates}
              onSaveSettings={(patch) => setSettings((x) => ({ ...x, ...patch }))}
              onAdopt={(inv) => { save("investments", inv); setSheet(null); }}
            />
          </Suspense>
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
              onDiv={() => setSheet({ type: "div", gkey: g.gkey })}
              onDeleteDiv={removeDiv}
              onAddLot={() => setSheet({
                type: "invest",
                back: g.gkey,
                preset: {
                  type: g.type, symbol: g.ref.symbol || "", name: g.name, logoUrl: g.ref.logoUrl || "",
                  coinId: g.ref.coinId, commodity: g.ref.commodity, unit: g.ref.unit,
                  qty: "", buyPrice: "", buyDate: "", price: g.price ? String(g.price) : "", inChart: g.inChart,
                },
              })}
              onEditLot={(l) => setSheet({ type: "invest", item: l, back: g.gkey })}
              onDeleteLot={(id) => withUndo("Kauf gelöscht", (d) => ({ ...d, investments: d.investments.filter((x) => x.id !== id) }))}
              onSell={() => setSheet({ type: "sell", gkey: g.gkey })}
              onDeleteSell={removeSell}
            />
          </Sheet>
        );
      })()}
      {sheet?.type === "sell" && (() => {
        const g = groups.find((x) => x.gkey === sheet.gkey);
        if (!g) return null;
        return (
          <Sheet title={`${g.name} verkaufen`} onClose={() => setSheet({ type: "group", gkey: g.gkey })}>
            <SellForm group={g} onSave={(s) => bookSell(g.gkey, s)} />
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
                      kind={(settings.taxIncomeCcy || (CURRENCIES.includes(settings.currency) ? settings.currency : "EUR")) === c ? "primary" : "ghost"}
                      onClick={() => setSettings({ ...settings, taxIncomeCcy: c })}
                      style={{ minWidth: 44 }}
                    >{c}</Btn>
                  ))}
                </div>
              </div>
            </Field>
            {(() => {
              const sysCur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
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
                  kind={(CURRENCIES.includes(settings.currency) ? settings.currency : "EUR") === c ? "primary" : "ghost"}
                  onClick={() => setSettings({ ...settings, currency: c })}
                  style={{ flex: 1 }}
                >
                  {c}
                </Btn>
              ))}
            </div>
          </Field>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: C.muted, margin: "-6px 0 14px" }}>
            Bestehende Beträge werden nicht umgerechnet – sie gelten in der gewählten Währung.
            Live-Kurse (Aktien &amp; Krypto) werden automatisch in die gewählte Währung umgerechnet.
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
            Finnhub (kostenlos auf finnhub.io) liefert US-Aktien und -ETFs, Twelve Data (twelvedata.com) europäische Wertpapiere und Öl – dort funktioniert als Ticker auch die ISIN.
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
          <button type="button" className="fc-check" onClick={() => setExportKeys((v) => !v)}>
            <span className={`box ${exportKeys ? "on" : ""}`}>{exportKeys && <Check size={13} strokeWidth={3} />}</span>
            <span>API-Keys ins Backup aufnehmen</span>
          </button>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: C.muted }}>
            Deine Daten liegen ausschliesslich lokal auf diesem Gerät (Browser-Speicher) – kein Server, kein Konto.
            Das Backup enthält alle Einträge, das Steuerprofil und sämtliche Einstellungen (ohne App-Sperre).
            Nach aussen gehen nur Ticker an die Kursdienste (CoinGecko, Finnhub, Twelve Data, gold-api) und – falls aktiviert – an die Logo-Dienste.
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

      {/* ---------- Tab-Bar ---------- */}
      <nav className="fc-tabs">
        <div className="fc-tabs-inner">
          {[
            { id: "home", label: "Übersicht", ic: LayoutGrid },
            { id: "income", label: "Einnahmen", ic: Wallet },
            { id: "expenses", label: "Kosten", ic: Receipt },
            { id: "credits", label: "Kredite", ic: Landmark },
            { id: "invest", label: "Invest", ic: TrendingUp },
            { id: "profil", label: "Profil", ic: User },
          ].map((t) => (
            <button key={t.id} className={`fc-tab ${tab === t.id ? "active" : ""}`} onClick={() => { setTab(t.id); setSheet(null); setSearch(""); }}>
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
