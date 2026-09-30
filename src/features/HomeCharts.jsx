import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, Sector, CartesianGrid } from "recharts";
import { C, SHADOW, MASK } from "../lib/constants.jsx";
import { CAN_HOVER } from "../lib/utils.js";
import { locale, eurFull } from "../lib/currency.js";

/* Diagramme der Übersicht – eigener Baustein, damit die Chart-Bibliothek nicht auf dem
   kritischen Pfad liegt: Zahlen und Listen stehen sofort, der Ring kommt nach. */

/* ---------- Ausgaben nach Kategorie ---------- */
export function CategoryDonut({ catTotals, masked }) {
  const [activeCat, setActiveCat] = useState(-1);
  const [hoverCat, setHoverCat] = useState(-1);
  const catSum = catTotals.reduce((a, c) => a + c.value, 0);
  /* Auswahl (Tap) hat Vorrang, Hover nur als Vorschau auf Desktop */
  const shownCat = activeCat >= 0 && activeCat < catTotals.length
    ? activeCat
    : (hoverCat >= 0 && hoverCat < catTotals.length ? hoverCat : -1);
  const shown = shownCat >= 0 ? catTotals[shownCat] : null;
  const centerVal = masked ? MASK : eurFull(shown ? shown.value : catSum);
  /* Sehr lange Beträge kleiner setzen, damit sie nie an den Innenring stossen */
  const centerValSize = centerVal.length > 13 ? 14 : centerVal.length > 11 ? 15 : 17;
  return (
    <>
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
                <Cell key={c.id} fill={c.color} style={{ cursor: "pointer", opacity: shownCat < 0 || shownCat === i ? 1 : 0.42, transition: "opacity .15s" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Betrag als fixer Anker in der Ringmitte – kein Text verschiebt ihn */}
        <div className="fc-pie-center">
          <div className="vl" style={{ fontSize: centerValSize }}>{centerVal}</div>
          <div className="sh">{shown && catSum > 0 ? `${Math.round((shown.value / catSum) * 100)} %` : "pro Monat"}</div>
        </div>
      </div>
      {/* Kategoriename ausserhalb des Rings: volle Breite, feste Zeilenhöhe */}
      <div className="fc-pie-caption">
        {shown && <span className="dot" style={{ background: shown.color }} />}
        <span className="tx">{shown ? shown.label : "Gesamtausgaben – Kategorie antippen"}</span>
      </div>
    </>
  );
}

/* ---------- Vermögensverlauf ---------- */
export function WealthChart({ series, monthName, masked }) {
  /* Y-Achse eng an den Verlauf legen, damit die Entwicklung sichtbar ist */
  const lo = Math.min(...series.map((p) => p.net));
  const hi = Math.max(...series.map((p) => p.net));
  const pad = Math.max((hi - lo) * 0.18, Math.abs(hi) * 0.02, 1);
  const domain = [Math.round(lo - pad), Math.round(hi + pad)];
  return (
    <div style={{ width: "100%", height: 190 }}>
      <ResponsiveContainer>
        <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
          <XAxis dataKey="m" tickFormatter={monthName} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} minTickGap={30} />
          <YAxis domain={domain} width={masked ? 10 : 58} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline}
            tickFormatter={(v) => (masked ? "" : Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} Mio` : Math.round(v).toLocaleString(locale()))} />
          <Tooltip
            labelFormatter={monthName}
            formatter={(v) => [masked ? MASK : eurFull(v), "Nettovermögen"]}
            contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 12.5, boxShadow: SHADOW }}
            labelStyle={{ color: C.muted }}
            itemStyle={{ color: C.ink }}
          />
          <Line type="monotone" dataKey="net" stroke={C.rausch} strokeWidth={2.4} dot={{ r: 3, fill: C.rausch, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
