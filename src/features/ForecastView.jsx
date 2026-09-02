import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Info } from "lucide-react";
import { C, SHADOW } from "../lib/constants.jsx";
import { curSym, eur, eurFull } from "../lib/currency.js";
import { Field, NumInput } from "../components/ui.jsx";

/* ---------- Prognose (Zinseszins) ---------- */
export default function ForecastView({ surplus, startValue }) {
  const [info, setInfo] = useState(false);
  const [ratePct, setRatePct] = useState("5");
  const [contrib, setContrib] = useState(String(Math.max(0, Math.round(surplus || 0))));
  const P = Math.max(0, startValue || 0);
  const C0 = Math.max(0, Number(contrib) || 0);
  const annual = Math.max(0, Number(ratePct) || 0) / 100;
  const r = Math.pow(1 + annual, 1 / 12) - 1;
  const value = (m) => (r > 0 ? P * Math.pow(1 + r, m) + C0 * ((Math.pow(1 + r, m) - 1) / r) : P + C0 * m);
  const months = [];
  for (let m = 1; m <= 24; m++) months.push(m);
  for (let m = 27; m <= 120; m += 3) months.push(m);
  for (let m = 132; m <= 480; m += 12) months.push(m);
  const series = months.map((m) => ({ m, value: Math.round(value(m)) }));
  const xTicks = [1, 3, 6, 12, 24, 60, 120, 240, 360, 480];
  const xFmt = (m) => (m < 12 ? `${m} M` : `${Math.round(m / 12)} J`);
  const compact = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + " Mio";
    if (a >= 1e3) return Math.round(v / 1e3) + "k";
    return String(Math.round(v));
  };
  const milestones = [12, 60, 120, 240, 480];
  const invested = (m) => P + C0 * m;
  return (
    <div>
      <div className="fc-row2" style={{ marginBottom: 6 }}>
        <Field label="Jährlicher Zins (%)">
          <input type="number" inputMode="decimal" value={ratePct} onChange={(e) => setRatePct(e.target.value)} placeholder="5" />
        </Field>
        <Field label={`Monatlich sparen (${curSym()})`}>
          <NumInput value={contrib} onChange={setContrib} />
        </Field>
      </div>
      <div className="fc-inforow">
        <button type="button" className="fc-info" onClick={() => setInfo((v) => !v)} aria-expanded={info} aria-label="Erklärung zur Prognose">
          <Info size={15} strokeWidth={2} />
        </button>
        <span className="fc-infolbl" onClick={() => setInfo((v) => !v)}>Wie wird gerechnet?</span>
      </div>
      {info && (
        <div style={{ fontSize: 13, color: C.muted, margin: "8px 0 12px", lineHeight: 1.45 }}>
          Startwert ist dein heutiges Nettovermögen ({eur(P)}), verzinst mit Zinseszins (monatlich).
          X-Achse logarithmisch – links Monate, rechts bis 40 Jahre.
        </div>
      )}
      <div style={{ width: "100%", height: 240, marginTop: info ? 0 : 8 }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 14, bottom: 2, left: 2 }}>
            <XAxis dataKey="m" type="number" scale="log" domain={[1, 480]} ticks={xTicks} tickFormatter={xFmt} tick={{ fontSize: 11, fill: C.muted }} stroke={C.hairline} />
            <YAxis tickFormatter={compact} width={46} tick={{ fontSize: 11, fill: C.muted }} stroke={C.hairline} />
            <Tooltip
              formatter={(v) => [eurFull(v), "Vermögen"]}
              labelFormatter={(m) => (m < 12 ? `${m} Monate` : `${(m / 12).toFixed(m % 12 ? 1 : 0).replace(".", ",")} Jahre`)}
              contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 13, boxShadow: SHADOW }}
              labelStyle={{ color: C.muted }}
              itemStyle={{ color: C.ink }}
            />
            <Line type="monotone" dataKey="value" stroke={C.rausch} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 14 }}>
        {milestones.map((m) => {
          const val = Math.round(value(m));
          const zins = Math.max(0, val - Math.round(invested(m)));
          return (
            <div className="fc-forecast-row" key={m}>
              <span style={{ color: C.muted }}>{m < 12 ? `in ${m} Monaten` : `in ${m / 12} Jahren`}</span>
              <span className="fv">{eur(val)} <span style={{ color: C.positive, fontWeight: 500, fontSize: 13 }}>+{eur(zins)} Zins</span></span>
            </div>
          );
        })}
      </div>
      {C0 <= 0 && P <= 0 && (
        <div style={{ fontSize: 13, color: C.muted, marginTop: 12, lineHeight: 1.4 }}>
          Erfasse Einnahmen und Kosten, damit ein monatlicher Überschuss entsteht – dann zeigt die Prognose, wie dein Vermögen wächst.
        </div>
      )}
    </div>
  );
}
