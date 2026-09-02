import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Check, ChevronDown } from "lucide-react";
import { C, SAVE_CAT } from "../lib/constants.jsx";
import { locale, parseAmount, eur } from "../lib/currency.js";
import { logoCandidates } from "../lib/api.js";

/* ---------- Kleine UI-Bausteine ---------- */
export const Card = ({ children, style }) => (
  <div className="fc-card" style={style}>{children}</div>
);

export const SectionTitle = ({ children, right }) => (
  <div className="fc-sectiontitle">
    <span>{children}</span>
    {right}
  </div>
);

export const Empty = ({ text, action }) => (
  <Card style={{ textAlign: "center", padding: "28px 16px" }}>
    <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.43, marginBottom: action ? 14 : 0 }}>{text}</div>
    {action}
  </Card>
);

export const Btn = ({ children, onClick, kind = "primary", small, disabled, style }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`fc-btn ${kind} ${small ? "small" : ""}`}
    style={style}
  >
    {children}
  </button>
);

export const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="fc-search">
    <span className="ic"><Search size={16} strokeWidth={2} /></span>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    {value && <button className="clr" onClick={() => onChange("")} aria-label="Suche leeren">×</button>}
  </div>
);

/* Betragsfeld: Komma-Eingabe, Tausenderpunkte beim Verlassen des Feldes */
export function NumInput({ value, onChange, placeholder = "0", autoFocus }) {
  const fmt = (v) => {
    const n = Number(v);
    if (v === "" || v == null || isNaN(n)) return "";
    return n.toLocaleString(locale(), { maximumFractionDigits: 8 });
  };
  const [txt, setTxt] = useState("");
  const [live, setLive] = useState(false);
  /* Solange nicht getippt wird, zeigt das Feld den formatierten Wert von aussen */
  const shown = live ? txt : fmt(value);
  const parse = parseAmount;
  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      value={shown}
      placeholder={placeholder}
      onFocus={() => { setLive(true); setTxt(value === "" || value == null ? "" : String(value).replace(".", ",")); }}
      onChange={(e) => { setTxt(e.target.value); onChange(parse(e.target.value)); }}
      onBlur={() => { setLive(false); }}
    />
  );
}

export const Field = ({ label, children }) => (
  <label className="fc-field">
    <span>{label}</span>
    {children}
  </label>
);

export const YearTag = () => <span className="fc-tag">Jährlich</span>;

/* Untertitel aus mehreren kurzen Teilen – mit dezentem Trenner statt Textpunkt */
export const Sub = ({ parts }) => (
  <>
    {parts.filter(Boolean).map((p, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="sep">·</span>}
        {p}
      </React.Fragment>
    ))}
  </>
);

export const Lead = ({ icon: Ic }) => (
  <span className="fc-lead"><Ic size={18} strokeWidth={1.75} /></span>
);

export function AssetLogo({ inv, enabled = true }) {
  const candidates = useMemo(() => (enabled ? logoCandidates(inv) : []), [inv.symbol, inv.type, inv.logoUrl, enabled]);
  const [state, setState] = useState({ key: "", idx: 0 });
  const key = `${inv.symbol}|${inv.type}|${inv.logoUrl}`;
  const idx = state.key === key ? state.idx : 0;
  const setIdx = (fn) => setState((s) => ({ key, idx: fn(s.key === key ? s.idx : 0) }));
  const sym = (inv.symbol || "").trim();
  if (!candidates.length || idx >= candidates.length) {
    return <span className="fc-lead fc-monogram">{(sym || inv.name || "?").slice(0, 2).toUpperCase()}</span>;
  }
  return <img className="fc-logo" src={candidates[idx]} alt="" loading="lazy" onError={() => setIdx((i) => i + 1)} />;
}

/* ---------- Modal (Bottom Sheet) ----------
   role="dialog" + aria-modal, Escape schliesst, Fokus geht beim Öffnen in den
   Sheet und beim Schliessen zurück zum auslösenden Element. */
export function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const el = ref.current;
    if (el) {
      const first = el.querySelector("input, select, textarea, button:not(.fc-x)");
      (first || el).focus({ preventScroll: true });
    }
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !el) return;
      const f = [...el.querySelectorAll("input, select, textarea, button, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <div className="fc-overlay" onClick={onClose}>
      <div className="fc-sheet" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="fc-sheet-head">
          <span>{title}</span>
          <button className="fc-x" onClick={onClose} aria-label="Schliessen">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}


/* ---------- kleine UI-Helfer ---------- */
export const InfoNote = ({ children }) => (
  <div className="fc-detail-note" style={{ marginTop: 10 }}>{children}</div>
);
export const Kpi = ({ label, value, color }) => (
  <div style={{ flex: 1, background: C.soft, borderRadius: 12, padding: "10px 12px" }}>
    <div style={{ fontSize: 11.5, color: C.muted }}>{label}</div>
    <div style={{ fontSize: 17, fontWeight: 600, color: color || C.ink, marginTop: 2 }}>{value}</div>
  </div>
);
export const Collapse = ({ title, icon: Ic, open, onToggle, children }) => (
  <div style={{ border: `1px solid ${C.hairline}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 14px",
        background: "none", border: "none", cursor: "pointer", font: "inherit", color: C.ink,
      }}
    >
      {Ic && <Ic size={17} strokeWidth={1.9} color={C.muted} />}
      <span style={{ fontSize: 14.5, fontWeight: 500, flex: 1, textAlign: "left" }}>{title}</span>
      <ChevronDown size={17} strokeWidth={2} color={C.muted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
    </button>
    {open && <div style={{ padding: "2px 14px 14px" }}>{children}</div>}
  </div>
);

/* ---------- Listenzeile ----------
   Auf Modulebene, damit React die Zeilen zwischen Renders wiederverwendet.
   Der Hauptbereich ist ein echter Button: per Tastatur erreichbar. */
export const ListItem = ({ lead, title, sub, value, valueColor, tag, onEdit, onDelete, note }) => (
  <div className="fc-item">
    {lead}
    <button type="button" className="fc-item-main" onClick={onEdit}>
      <div className="fc-item-title">{title}{tag}</div>
      <div className="fc-item-sub">{sub}</div>
      {note && <div className="fc-note">{note}</div>}
    </button>
    <div className="fc-item-right">
      <div className="fc-item-value" style={{ color: valueColor || C.ink }}>{value}</div>
      {onDelete && <button className="fc-del" onClick={onDelete} aria-label="Löschen">–</button>}
    </div>
  </div>
);


/* ---------- Cashflow-Leiste ---------- */
export function CashflowBar({ catTotals, creditRate, surplus, savings = 0, budgetFree = 0, budgetMode = false }) {
  const [open, setOpen] = useState(false);
  const segs = [
    ...catTotals.filter((c) => c.value > 0).map((c) => ({ label: c.label, value: c.value, color: c.color })),
    ...(creditRate > 0 ? [{ label: "Kredite", value: creditRate, color: C.ink }] : []),
    ...(budgetMode && savings > 0 ? [{ label: SAVE_CAT.label, value: savings, color: SAVE_CAT.color }] : []),
    ...(budgetMode
      ? (budgetFree > 0 ? [{ label: "Budget frei", value: budgetFree, color: C.positive }] : [])
      : (surplus > 0 ? [{ label: "Überschuss", value: surplus, color: C.positive }] : [])),
  ];
  const total = segs.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const sorted = [...segs].sort((a, b) => b.value - a.value);
  return (
    <div>
      <button className="fc-flowtoggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Details ausblenden" : "Details anzeigen"}>
        <div className="fc-flowbar">
          {segs.map((s, i) => (
            <div key={i} title={`${s.label}: ${eur(s.value)}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          ))}
        </div>
        <span className={`fc-flowchev ${open ? "open" : ""}`}><ChevronDown size={16} strokeWidth={2} /></span>
      </button>
      <div className="fc-flowlist" style={{ display: open ? "flex" : "none" }}>
        {sorted.map((s, i) => {
          const pct = (s.value / total) * 100;
          return (
            <div className="fc-flowrow" key={i}>
              <span className="dot" style={{ background: s.color }} />
              <span className="lbl">{s.label}</span>
              <span className="track"><span className="fill" style={{ width: `${Math.max(2, pct)}%`, background: s.color }} /></span>
              <span className="amt">{eur(s.value)}</span>
              <span className="pct">{pct < 1 ? "<1" : Math.round(pct)} %</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
