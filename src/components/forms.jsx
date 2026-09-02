import React, { useState, useMemo } from "react";
import { Check, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Percent } from "lucide-react";
import {
  C, INCOME_TYPES, INVEST_TYPES, COMMODITIES, VALUE_TYPES, EXPENSE_CATS, VARIABLE_CATS, SAVE_CAT,
  KNOWN_ASSETS, CURRENCIES,
} from "../lib/constants.jsx";
import { getCur, curSym, eur, eurFull, money, fmtQty, fmtDay } from "../lib/currency.js";
import { todayIso, addDays } from "../lib/utils.js";
import { payoffPlan, monthsUntil, monthsLabel, fifo, cashAmount, propValueAt } from "../lib/finance.js";
import { Btn, Field, NumInput, Sub } from "./ui.jsx";

/* ---------- Formulare ---------- */
export function IncomeForm({ initial, onSave }) {
  const [f, setF] = useState(initial || { name: "", type: "gehalt", amount: "" });
  return (
    <div className="fc-form">
      <Field label="Bezeichnung">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Gehalt" />
      </Field>
      <div className="fc-row2">
        <Field label="Art">
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {INCOME_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label={`Betrag / Monat (${curSym()})`}>
          <NumInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} placeholder="0" />
        </Field>
      </div>
      <Btn disabled={!f.name || !f.amount} onClick={() => onSave({ ...f, amount: Number(f.amount) })}>Speichern</Btn>
    </div>
  );
}

export function ExpenseForm({ initial, kind, onSave, catList, onAddCat }) {
  const effKind = (initial && initial.kind) || kind || "fix";
  const isSave = effKind === "sparen";
  const cats = isSave ? [SAVE_CAT] : catList || (effKind === "variabel" ? VARIABLE_CATS : EXPENSE_CATS);
  const [f, setF] = useState(initial || { name: isSave ? "Sparrate" : "", category: cats[0].id, amount: "", interval: "monatlich", kind: effKind });
  const [newCat, setNewCat] = useState("");
  const isFix = !isSave && effKind !== "variabel";
  return (
    <div className="fc-form">
      <Field label="Bezeichnung">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={isSave ? "z. B. Sparrate, ETF-Sparplan" : effKind === "variabel" ? "z. B. Wocheneinkauf" : "z. B. Haftpflicht"} />
      </Field>
      {!isSave && (
        <Field label="Kategorie">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            <option value="__new">＋ Neue Kategorie …</option>
          </select>
        </Field>
      )}
      {f.category === "__new" && (
        <Field label="Name der neuen Kategorie">
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="z. B. Haustier" autoFocus />
            <Btn
              small
              disabled={!newCat.trim()}
              onClick={() => { const id = onAddCat(newCat.trim(), effKind); setF({ ...f, category: id }); setNewCat(""); }}
              style={{ flexShrink: 0 }}
            >Anlegen</Btn>
          </div>
        </Field>
      )}
      <div className="fc-row2">
        <Field label={`Betrag (${curSym()})`}>
          <NumInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} placeholder="0" />
        </Field>
        <Field label="Intervall">
          <select value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value })}>
            <option value="monatlich">monatlich</option>
            <option value="jaehrlich">jährlich</option>
          </select>
        </Field>
      </div>
      {isFix && (
        <>
          <div className="fc-row2">
            <Field label="Vertrag bis">
              <input type="date" value={f.until || ""} onChange={(e) => setF({ ...f, until: e.target.value })} />
            </Field>
            <Field label="Kündigungsfrist (Mon.)">
              <input type="number" inputMode="numeric" value={f.notice ?? ""} onChange={(e) => setF({ ...f, notice: e.target.value })} placeholder="z. B. 3" />
            </Field>
          </div>
          <div style={{ fontSize: 13, color: C.muted, margin: "-6px 0 14px", lineHeight: 1.4 }}>
            Optional: Mit Vertragsende und Frist erinnert dich die App, sobald die Kündigung fällig wird.
          </div>
        </>
      )}
      <Btn
        disabled={!f.name || !f.amount || f.category === "__new"}
        onClick={() => onSave({ ...f, kind: effKind, amount: Number(f.amount), notice: f.notice === "" || f.notice == null ? "" : Number(f.notice) })}
      >Speichern</Btn>
    </div>
  );
}

export function CreditForm({ initial, onSave }) {
  const [f, setF] = useState(initial || { name: "", rate: "", balance: "", interest: "", paymentDay: "", endDate: "" });
  const handleSave = () => {
    const paymentDay = Math.min(31, Math.max(0, Math.round(Number(f.paymentDay) || 0)));
    /* Restschuld gilt ab heute: Buchungen zählen erst ab der nächsten fälligen Abbuchung */
    const now = new Date();
    const idx = now.getFullYear() * 12 + now.getMonth();
    const lastAppliedIdx = paymentDay ? (now.getDate() >= paymentDay ? idx : idx - 1) : undefined;
    onSave({
      ...f,
      rate: Number(f.rate),
      balance: Number(f.balance) || 0,
      interest: Number(f.interest) || 0,
      endDate: f.endDate || "",
      fixedUntil: f.fixedUntil || "",
      followInterest: f.followInterest === "" || f.followInterest == null ? "" : Number(f.followInterest),
      paymentDay,
      lastAppliedIdx,
    });
  };
  return (
    <div className="fc-form">
      <Field label="Bezeichnung">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Immobilienkredit" />
      </Field>
      <div className="fc-row2">
        <Field label={`Monatsrate (${curSym()})`}>
          <NumInput value={f.rate} onChange={(v) => setF({ ...f, rate: v })} placeholder="0" />
        </Field>
        <Field label={`Restschuld (${curSym()})`}>
          <NumInput value={f.balance} onChange={(v) => setF({ ...f, balance: v })} placeholder="0" />
        </Field>
      </div>
      <div className="fc-row2">
        <Field label="Zinssatz (% p. a.)">
          <NumInput value={f.interest} onChange={(v) => setF({ ...f, interest: v })} placeholder="z. B. 3,2" />
        </Field>
        <Field label="Abbuchungstag">
          <input type="number" inputMode="numeric" value={f.paymentDay || ""} onChange={(e) => setF({ ...f, paymentDay: e.target.value })} placeholder="1–31" />
        </Field>
      </div>
      <Field label="Tilgungsschluss">
        <input type="date" value={f.endDate || ""} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
      </Field>
      <div className="fc-row2">
        <Field label="Zinsbindung bis">
          <input type="date" value={f.fixedUntil || ""} onChange={(e) => setF({ ...f, fixedUntil: e.target.value })} />
        </Field>
        <Field label="Zins danach (%)">
          <NumInput value={f.followInterest ?? ""} onChange={(v) => setF({ ...f, followInterest: v })} placeholder="z. B. 4" />
        </Field>
      </div>
      <div style={{ margin: "-6px 0 14px", fontSize: 13, lineHeight: 1.35, color: C.muted }}>
        Zinssatz, Abbuchungstag und Tilgungsschluss sind optional. Mit Abbuchungstag (1–31) tilgt die App automatisch jeden Monat
        (Rate minus Zinsanteil), mit Tilgungsschluss kommt die Restlaufzeit aus deinem Vertrag statt aus der Hochrechnung.
      </div>
      <Btn disabled={!f.name || !f.rate} onClick={handleSave}>Speichern</Btn>
    </div>
  );
}

export function InvestForm({ initial, onSave, finnhubKey }) {
  const [f, setF] = useState(initial || { name: "", symbol: "", type: "etf", qty: "", buyPrice: "", price: "", logoUrl: "", buyDate: "", inChart: true });
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");

  async function lookup() {
    const sym = (f.symbol || "").trim().toUpperCase();
    if (!sym || f.name) return;
    const known = KNOWN_ASSETS[sym];
    if (known) {
      setF((p) => ({ ...p, name: known.name, type: known.type }));
      return;
    }
    setLooking(true);
    setLookupMsg("");
    let found = null;
    /* 1) CoinGecko-Suche (deckt Krypto ab, kein Key nötig) */
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`);
      const j = await r.json();
      const coin = (j.coins || []).find((x) => (x.symbol || "").toUpperCase() === sym);
      if (coin) found = { name: coin.name, type: "krypto" };
    } catch { /* weiter mit Finnhub */ }
    /* 2) Finnhub-Suche (Aktien/ETFs, Key nötig) */
    if (!found && finnhubKey) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(sym)}&token=${finnhubKey}`);
        const j = await r.json();
        const hit = (j.result || []).find((x) => (x.symbol || "").toUpperCase() === sym) || (j.result || [])[0];
        if (hit && hit.description) {
          const pretty = hit.description
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
          found = { name: pretty, type: hit.type === "ETP" ? "etf" : "aktie" };
        }
      } catch { /* Fallback unten */ }
    }
    if (found) {
      setF((p) => ({
        ...p,
        name: p.name || found.name,
        type: INVEST_TYPES.some((t) => t.id === found.type) ? found.type : p.type,
      }));
    } else {
      setLookupMsg(finnhubKey
        ? "Ticker nicht erkannt – Name bitte manuell eintragen."
        : "Ticker nicht erkannt. Tipp: Mit Finnhub-Key (Einstellungen) werden auch Aktien/ETFs erkannt.");
    }
    setLooking(false);
  }

  const sym = (f.symbol || "").trim().toUpperCase();
  const isValueType = VALUE_TYPES.includes(f.type);

  return (
    <div className="fc-form">
      <Field label="Typ">
        <select value={f.type} onChange={(e) => { const t = e.target.value; setF((p) => ({ ...p, type: t, ...(t === "rohstoff" && !p.commodity ? { commodity: "gold", name: "Gold", unit: "Unzen", symbol: "gold" } : {}) })); }}>
          {INVEST_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>

      {f.type === "rohstoff" ? (
        <>
          <Field label="Rohstoff">
            <select value={f.commodity || "gold"} onChange={(e) => { const c = COMMODITIES.find((x) => x.id === e.target.value); setF({ ...f, commodity: c.id, name: c.label, unit: c.unit, symbol: c.id }); }}>
              {COMMODITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <div className="fc-row2">
            <Field label={`Menge (${(COMMODITIES.find((x) => x.id === (f.commodity || "gold")) || {}).unit})`}>
              <NumInput value={f.qty} onChange={(v) => setF({ ...f, qty: v })} placeholder="0" />
            </Field>
            <Field label={`Kaufkurs (${curSym()})`}>
              <NumInput value={f.buyPrice} onChange={(v) => setF({ ...f, buyPrice: v })} placeholder="0" />
            </Field>
          </div>
          <div className="fc-row2">
            <Field label="Kaufdatum">
              <input type="date" value={f.buyDate || ""} onChange={(e) => setF({ ...f, buyDate: e.target.value })} />
            </Field>
            <Field label={`Aktueller Kurs (${curSym()})`}>
              <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
            </Field>
          </div>
          <div style={{ fontSize: 13, color: C.muted, margin: "-2px 0 12px", lineHeight: 1.4 }}>
            Edelmetalle werden automatisch aktualisiert (in Unzen). Öl braucht einen Twelve-Data-Key in den Einstellungen.
          </div>
          <Btn
            disabled={!f.qty}
            onClick={() => { const c = COMMODITIES.find((x) => x.id === (f.commodity || "gold")); onSave({ ...f, commodity: c.id, name: f.name || c.label, unit: c.unit, symbol: c.id, inChart: false, qty: Number(f.qty), buyPrice: Number(f.buyPrice) || 0, price: Number(f.price) || Number(f.buyPrice) || 0 }); }}
          >Speichern</Btn>
        </>
      ) : isValueType ? (
        <>
          <Field label="Bezeichnung">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.type === "immobilie" ? "z. B. Eigenheim" : "z. B. Tagesgeld"} />
          </Field>
          {f.type === "cash" && (
            <Field label="Währung">
              <div style={{ display: "flex", gap: 8 }}>
                {CURRENCIES.map((c) => (
                  <Btn key={c} kind={(f.ccy || getCur()) === c ? "primary" : "ghost"} onClick={() => setF({ ...f, ccy: c })} style={{ flex: 1 }}>{c}</Btn>
                ))}
              </div>
            </Field>
          )}
          {f.type === "immobilie" ? (
            <>
              <div className="fc-row2">
                <Field label={`Kaufpreis (${curSym()})`}>
                  <NumInput value={f.buyPrice} onChange={(v) => setF({ ...f, buyPrice: v })} placeholder="0" />
                </Field>
                <Field label="Kaufdatum">
                  <input type="date" value={f.buyDate || ""} onChange={(e) => setF({ ...f, buyDate: e.target.value })} />
                </Field>
              </div>
              <Field label="Heutiger Wert">
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn kind={(f.valMode || "value") === "value" ? "primary" : "ghost"} onClick={() => setF({ ...f, valMode: "value" })} style={{ flex: 1 }}>Betrag</Btn>
                  <Btn kind={f.valMode === "rate" ? "primary" : "ghost"} onClick={() => setF({ ...f, valMode: "rate" })} style={{ flex: 1 }}>Rate</Btn>
                </div>
              </Field>
              {f.valMode === "rate" ? (
                <Field label="Wertsteigerung (% pro Jahr)">
                  <NumInput value={f.growth} onChange={(v) => setF({ ...f, growth: v })} placeholder="2" />
                </Field>
              ) : (
                <Field label={`Aktueller Wert (${curSym()})`}>
                  <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
                </Field>
              )}
            </>
          ) : (
            <Field label={`Betrag (${f.ccy || getCur()})`}>
              <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
            </Field>
          )}
          {f.type === "immobilie" && (
            <div style={{ fontSize: 13, color: C.muted, margin: "-2px 0 12px", lineHeight: 1.4 }}>
              {f.valMode === "rate"
                ? "Der Wert wächst ab dem Kaufdatum jährlich mit dieser Rate."
                : "Zwischen Kaufpreis und heutigem Wert wird gleichmässig interpoliert."}
              {!f.buyDate && " Für den Verlaufs-Chart ist ein Kaufdatum nötig."}
            </div>
          )}
          {f.type === "cash" && (f.ccy || getCur()) !== getCur() && (
            <div style={{ fontSize: 13, color: C.muted, margin: "-2px 0 12px", lineHeight: 1.4 }}>
              Der Betrag wird mit dem aktuellen Wechselkurs in {getCur()} umgerechnet.
            </div>
          )}
          <button type="button" className="fc-check" onClick={() => setF({ ...f, inChart: f.inChart === false })}>
            <span className={`box ${f.inChart !== false ? "on" : ""}`}>{f.inChart !== false && <Check size={13} strokeWidth={3} />}</span>
            <span>Im Verlaufs-Chart anzeigen</span>
          </button>
          <Btn
            disabled={!f.name || (f.type === "immobilie" ? (f.valMode === "rate" ? !f.buyPrice : !f.price) : !f.price)}
            onClick={() => {
              const isProp = f.type === "immobilie";
              const valMode = isProp ? (f.valMode === "rate" ? "rate" : "value") : undefined;
              const base = Number(f.buyPrice) || Number(f.price) || 0;
              const growth = Number(f.growth) || 0;
              /* Bei "Rate" ergibt sich der heutige Wert aus Kaufpreis, Datum und Rate */
              const price = isProp
                ? (valMode === "rate"
                    ? propValueAt({ buyPrice: base, buyDate: f.buyDate, valMode: "rate", growth }, todayIso())
                    : Number(f.price) || base)
                : Number(f.price) || 0;
              onSave({
                ...f,
                symbol: "",
                qty: 1,
                ccy: f.type === "cash" ? (f.ccy || getCur()) : undefined,
                valMode,
                growth: isProp ? growth : undefined,
                growthBase: undefined,
                growthFrom: undefined,
                buyDate: isProp ? (f.buyDate || "") : f.buyDate,
                price: Number(price.toFixed(2)),
                buyPrice: f.type === "cash" ? Number(f.price) || 0 : base,
              });
            }}
          >Speichern</Btn>
        </>
      ) : (
        <>
          <Field label="Symbol / Ticker">
            <input
              value={f.symbol}
              onChange={(e) => setF({ ...f, symbol: e.target.value.toUpperCase(), name: "" })}
              onBlur={lookup}
              placeholder="z. B. AAPL, IWDA, BTC"
              autoFocus={!initial}
            />
          </Field>
          <Field label="Name">
            <input
              value={looking ? "" : f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder={looking ? "Wird ermittelt …" : "Wird automatisch ausgefüllt"}
              disabled={looking}
            />
          </Field>
          {lookupMsg && <div style={{ margin: "-6px 0 12px", fontSize: 13, color: C.error }}>{lookupMsg}</div>}
          <div className="fc-row2">
            <Field label="Anzahl">
              <NumInput value={f.qty} onChange={(v) => setF({ ...f, qty: v })} placeholder="0" />
            </Field>
            <Field label={`Kaufkurs (${curSym()})`}>
              <NumInput value={f.buyPrice} onChange={(v) => setF({ ...f, buyPrice: v })} placeholder="0" />
            </Field>
          </div>
          <div className="fc-row2">
            <Field label="Kaufdatum">
              <input type="date" value={f.buyDate || ""} onChange={(e) => setF({ ...f, buyDate: e.target.value })} />
            </Field>
            <Field label={`Aktueller Kurs (${curSym()})`}>
              <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
            </Field>
          </div>
          <Field label="Logo-URL (optional)">
            <input value={f.logoUrl || ""} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <button type="button" className="fc-check" onClick={() => setF({ ...f, inChart: f.inChart === false })}>
            <span className={`box ${f.inChart !== false ? "on" : ""}`}>{f.inChart !== false && <Check size={13} strokeWidth={3} />}</span>
            <span>Im Verlaufs-Chart anzeigen</span>
          </button>
          <Btn
            disabled={!sym || !f.qty || looking}
            onClick={() => onSave({ ...f, name: f.name || sym, symbol: sym, qty: Number(f.qty), buyPrice: Number(f.buyPrice) || 0, price: Number(f.price) || Number(f.buyPrice) || 0 })}
          >Speichern</Btn>
        </>
      )}
    </div>
  );
}

/* ---------- Kategorien verwalten ---------- */
export function CatManager({ sections, counts, onRename, onRemove }) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState("");
  const start = (c) => { setEditId(c.id); setDraft(c.label); };
  const commit = () => {
    const name = draft.trim();
    if (editId && name) onRename(editId, name);
    setEditId(null);
  };
  return (
    <div>
      {sections.map((sec) => (
        <div key={sec.kind} style={{ marginBottom: 18 }}>
          <div className="fc-catsec">{sec.label}</div>
          <div className="fc-catcard">
            {sec.list.map((c) => {
              const used = counts[c.id] || 0;
              const editing = editId === c.id;
              return (
                <div className={`fc-catrow ${editing ? "editing" : ""}`} key={c.id}>
                  <span className="dot" style={{ background: c.color }} />
                  {editing ? (
                    <input
                      className="fc-catinput"
                      value={draft}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditId(null); }}
                    />
                  ) : (
                    <div className="txt">
                      <div className="nm">{c.label}</div>
                      <div className="sub">{used ? `${used} ${used === 1 ? "Eintrag" : "Einträge"}` : "nicht genutzt"}</div>
                    </div>
                  )}
                  <div className="acts">
                    {editing ? (
                      <button className="fc-catbtn ok" onMouseDown={(e) => e.preventDefault()} onClick={commit} aria-label="Namen speichern">
                        <Check size={15} strokeWidth={2.4} />
                      </button>
                    ) : (
                      <>
                        <button className="fc-catbtn" onClick={() => start(c)} aria-label={`${c.label} umbenennen`}>
                          <Pencil size={14} strokeWidth={2} />
                        </button>
                        {c.custom && (
                          <button className="fc-catbtn del" disabled={used > 0} onClick={() => onRemove(c.id)} aria-label={`${c.label} löschen`}>
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="fc-detail-note">
        Zum Umbenennen auf das Stift-Symbol tippen. Eigene Kategorien legst du beim Erfassen einer Ausgabe an – löschen geht nur, solange keine Einträge daran hängen.
      </div>
    </div>
  );
}

/* ---------- Sparziel ---------- */
export function GoalForm({ initial, onSave }) {
  const [f, setF] = useState(initial || { name: "", target: "", saved: "", deadline: "" });
  return (
    <div className="fc-form">
      <Field label="Bezeichnung">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Notgroschen" autoFocus={!initial} />
      </Field>
      <div className="fc-row2">
        <Field label={`Zielbetrag (${curSym()})`}>
          <NumInput value={f.target} onChange={(v) => setF({ ...f, target: v })} />
        </Field>
        <Field label={`Schon gespart (${curSym()})`}>
          <NumInput value={f.saved} onChange={(v) => setF({ ...f, saved: v })} />
        </Field>
      </div>
      <Field label="Zieldatum">
        <input type="date" value={f.deadline || ""} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
      </Field>
      <Btn disabled={!f.name || !f.target} onClick={() => onSave({ ...f, target: Number(f.target) || 0, saved: Number(f.saved) || 0 })}>Speichern</Btn>
    </div>
  );
}

export function AmountForm({ label, hint, cta, onSave, initialDate = true }) {
  const [f, setF] = useState({ amt: "", date: todayIso() });
  const amt = Number(f.amt) || 0;
  return (
    <div className="fc-form">
      {hint && <div className="fc-detail-note" style={{ marginBottom: 14 }}>{hint}</div>}
      <div className="fc-row2">
        <Field label={label}>
          <NumInput value={f.amt} onChange={(v) => setF({ ...f, amt: v })} autoFocus />
        </Field>
        {initialDate && (
          <Field label="Datum">
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        )}
      </div>
      <Btn disabled={!amt} onClick={() => onSave({ amt, date: f.date })}>{cta}</Btn>
    </div>
  );
}

/* ---------- Dividende / Zinsertrag ---------- */
export function DivForm({ group, onSave }) {
  const [f, setF] = useState({ amt: "", date: todayIso(), toCash: true });
  const amt = Number(f.amt) || 0;
  return (
    <div className="fc-form">
      <div className="fc-detail-note" style={{ marginBottom: 14 }}>
        Bestand: <b>{fmtQty(group.qty)} {group.type === "rohstoff" ? (group.ref.unit || "Einheiten") : "Stück"}</b> – erfasse den erhaltenen Betrag nach Steuern.
      </div>
      <div className="fc-row2">
        <Field label={`Betrag (${curSym()})`}>
          <NumInput value={f.amt} onChange={(v) => setF({ ...f, amt: v })} autoFocus />
        </Field>
        <Field label="Datum">
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
      </div>
      <button type="button" className="fc-check" onClick={() => setF({ ...f, toCash: !f.toCash })}>
        <span className={`box ${f.toCash ? "on" : ""}`}>{f.toCash && <Check size={13} strokeWidth={3} />}</span>
        <span>Auf das Cash-Konto buchen</span>
      </button>
      <Btn disabled={!amt} onClick={() => onSave(f)}>Ausschüttung buchen</Btn>
    </div>
  );
}

/* ---------- Cash-Konto: Bewegungen ---------- */
export function CashDetail({ inv, fxRates, onIn, onOut, onEdit, onDeleteFlow }) {
  const ccy = inv.ccy || getCur();
  const amt = cashAmount(inv);
  const flows = [...(inv.flows || [])].sort((a, b) => (b.d || "").localeCompare(a.d || ""));
  return (
    <div>
      <div className="fc-detail-kpis">
        <div><span className="l">Bestand</span><span className="v">{money(amt, ccy)}</span></div>
        {ccy !== getCur() && <div><span className="l">In {getCur()}</span><span className="v">{eur(amt * (fxRates[ccy] || 1))}</span></div>}
        <div><span className="l">Währung</span><span className="v">{ccy}</span></div>
        <div><span className="l">Buchungen</span><span className="v">{flows.length}</span></div>
      </div>

      {flows.length > 0 && (
        <>
          <div className="fc-detail-sec">Bewegungen</div>
          {flows.slice(0, 12).map((f) => (
            <div className="fc-detail-row" key={f.id}>
              <div className="m">
                <div className="t" style={{ color: (Number(f.amt) || 0) >= 0 ? C.positive : C.ink }}>
                  {(Number(f.amt) || 0) >= 0 ? "+" : "−"}{money(Math.abs(Number(f.amt) || 0), ccy)}
                </div>
                <div className="s"><Sub parts={[fmtDay(f.d), f.label || "Verkaufserlös"]} /></div>
              </div>
              <div className="r">
                <button className="fc-del" onClick={() => onDeleteFlow(f.id)} aria-label="Buchung löschen">–</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Btn onClick={onIn} style={{ gap: 6 }}><ArrowDownLeft size={16} strokeWidth={2} /> Einzahlen</Btn>
        <Btn kind="ghost" onClick={onOut} style={{ gap: 6 }}><ArrowUpRight size={16} strokeWidth={2} /> Auszahlen</Btn>
      </div>
      <div style={{ marginTop: 10 }}><Btn kind="ghost" onClick={onEdit}>Konto bearbeiten</Btn></div>
    </div>
  );
}

/* ---------- Sondertilgung buchen ---------- */
export function ExtraPaymentForm({ credit, onSave, cashAvail = 0 }) {
  const [f, setF] = useState({ amt: "", date: todayIso(), fromCash: cashAvail > 0 });
  const amt = Number(f.amt) || 0;
  const bal = Number(credit.balance) || 0;
  const capped = Math.min(amt, bal);
  const before = payoffPlan(bal, credit.rate, credit.interest);
  const after = payoffPlan(bal - capped, credit.rate, credit.interest);
  const savedInterest = isFinite(before.interest) && isFinite(after.interest) ? before.interest - after.interest : null;
  const savedMonths = isFinite(before.months) && isFinite(after.months) ? before.months - after.months : null;

  return (
    <div className="fc-form">
      <div className="fc-detail-note" style={{ marginBottom: 14 }}>
        Restschuld heute: <b>{eurFull(bal)}</b>
        {credit.interest ? <> · {String(credit.interest).replace(".", ",")} % p. a.</> : null}
      </div>
      <div className="fc-row2">
        <Field label={`Betrag (${curSym()})`}>
          <NumInput value={f.amt} onChange={(v) => setF({ ...f, amt: v })} placeholder="0" autoFocus />
        </Field>
        <Field label="Datum">
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
      </div>
      <button type="button" className="fc-mini" onClick={() => setF({ ...f, amt: String(bal) })}>Restschuld komplett ablösen</button>
      {cashAvail > 0 && (
        <button type="button" className="fc-check" onClick={() => setF({ ...f, fromCash: !f.fromCash })}>
          <span className={`box ${f.fromCash ? "on" : ""}`}>{f.fromCash && <Check size={13} strokeWidth={3} />}</span>
          <span>Vom Cash-Konto abbuchen ({eur(cashAvail)} verfügbar)</span>
        </button>
      )}
      {f.fromCash && capped > cashAvail && (
        <div style={{ margin: "0 0 12px", fontSize: 13, color: C.error }}>Auf dem Cash-Konto liegen nur {eurFull(cashAvail)} – der Rest wird nicht abgebucht.</div>
      )}
      {amt > bal && <div style={{ margin: "0 0 12px", fontSize: 13, color: C.error }}>Mehr als die Restschuld ({eurFull(bal)}) ist nicht möglich – es werden {eurFull(bal)} gebucht.</div>}
      {capped > 0 && (
        <div className="fc-detail-note" style={{ marginBottom: 14 }}>
          Restschuld danach: <b>{eurFull(bal - capped)}</b>
          {savedMonths != null && savedMonths > 0 && <> · Laufzeit {savedMonths} Monate kürzer ({monthsLabel(after.months)} statt {monthsLabel(before.months)})</>}
          {savedInterest != null && savedInterest > 0 && <> · spart ca. <b style={{ color: C.positive }}>{eurFull(savedInterest)}</b> Zinsen</>}
        </div>
      )}
      <Btn disabled={!capped} onClick={() => onSave({ amt: capped, date: f.date || todayIso(), fromCash: f.fromCash && cashAvail > 0 })}>Sondertilgung buchen</Btn>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        Die Restschuld sinkt sofort – Nettovermögen und Dashboard rechnen automatisch neu.
      </div>
    </div>
  );
}

/* ---------- Kredit-Detail: Kennzahlen und Sondertilgungen ---------- */
export function CreditDetail({ credit, onExtra, onDeleteExtra, onEdit, onPlan }) {
  const bal = Number(credit.balance) || 0;
  const plan = payoffPlan(bal, credit.rate, credit.interest);
  const termMonths = monthsUntil(credit.endDate);
  const extras = [...(credit.extras || [])].sort((a, b) => (b.d || "").localeCompare(a.d || ""));
  const extraSum = extras.reduce((s, e) => s + (Number(e.amt) || 0), 0);

  return (
    <div>
      <div className="fc-detail-kpis">
        <div><span className="l">Restschuld</span><span className="v">{eur(bal)}</span></div>
        <div><span className="l">Monatsrate</span><span className="v">{eur(credit.rate)}</span></div>
        <div><span className="l">Zinssatz</span><span className="v">{credit.interest ? `${String(credit.interest).replace(".", ",")} %` : "–"}</span></div>
        <div>
          <span className="l">Restlaufzeit</span>
          <span className="v">{monthsLabel(termMonths != null ? termMonths : plan.months)}</span>
          <span className="l" style={{ marginTop: 1 }}>{credit.endDate ? `bis ${fmtDay(credit.endDate)}` : "rechnerisch"}</span>
        </div>
        {isFinite(plan.interest) && plan.interest > 0 && (
          <div><span className="l">Zinsen bis Ende</span><span className="v">{eur(plan.interest)}</span></div>
        )}
        {extraSum > 0 && (
          <div><span className="l">Sondertilgungen</span><span className="v" style={{ color: C.positive }}>{eur(extraSum)}</span></div>
        )}
      </div>

      {extras.length > 0 && (
        <>
          <div className="fc-detail-sec">Sondertilgungen</div>
          {extras.map((e) => (
            <div className="fc-detail-row" key={e.id}>
              <div className="m">
                <div className="t">{eurFull(e.amt)}</div>
                <div className="s">{fmtDay(e.d)}</div>
              </div>
              <div className="r">
                <button className="fc-del" onClick={() => onDeleteExtra(e.id)} aria-label="Sondertilgung löschen">–</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Btn disabled={bal <= 0} onClick={onExtra}>Sondertilgung</Btn>
        <Btn kind="ghost" onClick={onPlan} disabled={bal <= 0 || !(Number(credit.rate) > 0)}>Tilgungsplan</Btn>
      </div>
      <div style={{ marginTop: 10 }}><Btn kind="ghost" onClick={onEdit}>Kredit bearbeiten</Btn></div>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        {credit.paymentDay
          ? `Die Monatsrate wird am ${credit.paymentDay}. automatisch verbucht${credit.interest ? " – der Zinsanteil wird dabei abgezogen" : ""}.`
          : "Ohne Abbuchungstag bleibt die Restschuld unverändert – trage ihn beim Bearbeiten nach, dann tilgt die App automatisch."}
        {termMonths == null && " Trage einen Tilgungsschluss ein, dann kommt die Restlaufzeit aus deinem Vertrag statt aus der Hochrechnung."}
        {extras.length > 0 && " Beim Löschen einer Sondertilgung wird der Betrag der Restschuld wieder zugerechnet."}
      </div>
    </div>
  );
}

/* ---------- Verkaufen ---------- */
export function SellForm({ group, onSave }) {
  const unit = group.type === "rohstoff" ? (group.ref.unit || "Einheiten") : "Stück";
  const [f, setF] = useState({ qty: "", price: group.price ? String(group.price) : "", date: todayIso() });
  const qty = Number(f.qty) || 0;
  const price = Number(f.price) || 0;
  const tooMuch = qty > group.qty + 1e-9;
  /* Vorschau: welcher Gewinn wird nach FIFO realisiert? */
  const preview = useMemo(() => {
    if (!qty || !price) return null;
    const f2 = fifo(group.lots, [...group.sells, { id: "_p", qty, price, date: f.date || todayIso() }]);
    const m = f2.matches.find((x) => x.id === "_p");
    return m ? m.realized : null;
  }, [qty, price, f.date, group]);

  return (
    <div className="fc-form">
      <div className="fc-detail-note" style={{ marginBottom: 14 }}>
        Verfügbar: <b>{fmtQty(group.qty)} {unit}</b> · Ø Kaufkurs {eurFull(group.avgBuy)}
      </div>
      <div className="fc-row2">
        <Field label={`Menge (${unit})`}>
          <NumInput value={f.qty} onChange={(v) => setF({ ...f, qty: v })} placeholder="0" autoFocus />
        </Field>
        <Field label={`Verkaufskurs (${curSym()})`}>
          <NumInput value={f.price} onChange={(v) => setF({ ...f, price: v })} placeholder="0" />
        </Field>
      </div>
      <Field label="Verkaufsdatum">
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      </Field>
      <button type="button" className="fc-mini" onClick={() => setF({ ...f, qty: String(group.qty) })}>Alles verkaufen</button>
      {tooMuch && <div style={{ margin: "0 0 12px", fontSize: 13, color: C.error }}>Mehr als der Bestand ({fmtQty(group.qty)} {unit}) lässt sich nicht verkaufen.</div>}
      {!tooMuch && qty > 0 && price > 0 && (
        <div className="fc-detail-note" style={{ marginBottom: 14 }}>
          Erlös <b>{eurFull(qty * price)}</b> wird deinem Cash-Konto in {getCur()} zugebucht.
          {preview != null && <> Realisierter Gewinn nach FIFO: <b style={{ color: preview >= 0 ? C.positive : C.error }}>{preview >= 0 ? "+" : ""}{eurFull(preview)}</b>.</>}
        </div>
      )}
      <Btn disabled={!qty || !price || tooMuch} onClick={() => onSave({ qty, price, date: f.date || todayIso() })}>Verkauf buchen</Btn>
    </div>
  );
}

/* ---------- Asset-Detail: alle Käufe und Verkäufe einer Position ---------- */
export function AssetDetail({ group, divs = [], onAddLot, onEditLot, onDeleteLot, onSell, onDeleteSell, onDiv, onDeleteDiv }) {
  const unit = group.type === "rohstoff" ? (group.ref.unit || "Einheiten") : "Stück";
  const lots = [...group.lots].sort((a, b) => (a.buyDate || "9999-12-31").localeCompare(b.buyDate || "9999-12-31"));
  const sells = [...group.sells].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const realizedById = {};
  for (const m of group.matches || []) realizedById[m.id] = m.realized;
  const myDivs = [...divs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const divSum = myDivs.reduce((s, x) => s + (Number(x.amt) || 0), 0);
  const cut = addDays(todayIso(), -365);
  const div12 = myDivs.filter((x) => (x.date || "") >= cut).reduce((s, x) => s + (Number(x.amt) || 0), 0);
  const pct = group.cost > 0 ? (group.unreal / group.cost) * 100 : 0;

  return (
    <div>
      <div className="fc-detail-kpis">
        <div><span className="l">Wert</span><span className="v">{eur(group.value)}</span></div>
        <div><span className="l">Bestand</span><span className="v">{fmtQty(group.qty)} {unit}</span></div>
        <div><span className="l">Ø Kaufkurs</span><span className="v">{eurFull(group.avgBuy)}</span></div>
        <div><span className="l">Aktueller Kurs</span><span className="v">{eurFull(group.price)}</span></div>
        <div>
          <span className="l">Nicht realisiert</span>
          <span className="v" style={{ color: group.unreal >= 0 ? C.positive : C.error }}>
            {group.unreal >= 0 ? "+" : ""}{eur(group.unreal)}{group.cost > 0 ? ` · ${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")} %` : ""}
          </span>
        </div>
        <div>
          <span className="l">Realisiert (FIFO)</span>
          <span className="v" style={{ color: group.realized > 0 ? C.positive : group.realized < 0 ? C.error : C.muted }}>
            {group.realized >= 0 ? "+" : ""}{eur(group.realized)}
          </span>
        </div>
        {divSum > 0 && (
          <div>
            <span className="l">Ausschüttungen</span>
            <span className="v" style={{ color: C.positive }}>+{eur(divSum)}</span>
            <span className="l" style={{ marginTop: 1 }}>{div12 > 0 ? `${eur(div12)} letzte 12 Mon.` : "gesamt"}</span>
          </div>
        )}
      </div>

      <div className="fc-detail-sec">Käufe</div>
      {lots.map((l) => (
        <div className="fc-detail-row" key={l.id}>
          <div className="m" onClick={() => onEditLot(l)}>
            <div className="t">{fmtQty(l.qty)} {unit} × {eurFull(l.buyPrice || 0)}</div>
            <div className="s"><Sub parts={[l.buyDate ? fmtDay(l.buyDate) : "ohne Kaufdatum", l.inChart === false ? "nicht im Chart" : null]} /></div>
          </div>
          <div className="r">
            <span className="a">{eur((Number(l.qty) || 0) * (Number(l.buyPrice) || 0))}</span>
            <button className="fc-del" onClick={() => onDeleteLot(l.id)} aria-label="Kauf löschen">–</button>
          </div>
        </div>
      ))}

      {sells.length > 0 && (
        <>
          <div className="fc-detail-sec">Verkäufe</div>
          {sells.map((s) => (
            <div className="fc-detail-row" key={s.id}>
              <div className="m">
                <div className="t">{fmtQty(s.qty)} {unit} × {eurFull(s.price || 0)}</div>
                <div className="s">
                  <Sub parts={[
                    fmtDay(s.date),
                    <>realisiert{" "}
                      <b style={{ color: (realizedById[s.id] || 0) >= 0 ? C.positive : C.error }}>
                        {(realizedById[s.id] || 0) >= 0 ? "+" : ""}{eurFull(realizedById[s.id] || 0)}
                      </b>
                    </>,
                  ]} />
                </div>
              </div>
              <div className="r">
                <span className="a">{eur((Number(s.qty) || 0) * (Number(s.price) || 0))}</span>
                <button className="fc-del" onClick={() => onDeleteSell(s.id)} aria-label="Verkauf löschen">–</button>
              </div>
            </div>
          ))}
        </>
      )}

      {myDivs.length > 0 && (
        <>
          <div className="fc-detail-sec">Ausschüttungen</div>
          {myDivs.slice(0, 10).map((x) => (
            <div className="fc-detail-row" key={x.id}>
              <div className="m">
                <div className="t" style={{ color: C.positive }}>+{eurFull(x.amt)}</div>
                <div className="s">{fmtDay(x.date)}</div>
              </div>
              <div className="r">
                <button className="fc-del" onClick={() => onDeleteDiv(x.id)} aria-label="Ausschüttung löschen">–</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Btn onClick={onAddLot}>Zukauf</Btn>
        <Btn kind="ghost" disabled={group.qty <= 0} onClick={onSell}>Verkaufen</Btn>
      </div>
      <div style={{ marginTop: 10 }}>
        <Btn kind="ghost" onClick={onDiv} style={{ gap: 6 }}><Percent size={15} strokeWidth={2} /> Dividende / Zinsen</Btn>
      </div>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        Verkäufe werden nach FIFO abgerechnet: die ältesten Käufe gehen zuerst. Erlöse und Ausschüttungen landen auf deinem Cash-Konto.
      </div>
    </div>
  );
}
