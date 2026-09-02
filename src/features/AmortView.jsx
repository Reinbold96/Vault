import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { C, SHADOW } from "../lib/constants.jsx";
import { locale, eur, eurFull, fmtDay } from "../lib/currency.js";
import { amortSchedule, monthsLabel } from "../lib/finance.js";

/* ---------- Tilgungsplan ---------- */
export default function AmortView({ credit }) {
  const plan = useMemo(() => amortSchedule(credit), [credit]);
  const fixIdx = plan.fixMonths != null && plan.fixMonths <= plan.rows.length ? plan.fixMonths : null;
  /* Zwei Linien: bis Zinsbindungsende durchgezogen, danach gestrichelt (Annahme) */
  const chart = useMemo(() => {
    const step = Math.max(1, Math.ceil(plan.rows.length / 300));
    return plan.rows
      .filter((_, i) => i % step === 0 || i === plan.rows.length - 1)
      .map((r) => ({
        ...r,
        bal1: fixIdx == null || r.m <= fixIdx ? r.bal : null,
        bal2: fixIdx != null && r.m >= fixIdx ? r.bal : null,
      }));
  }, [plan.rows, fixIdx]);
  const fixRow = fixIdx ? plan.rows[fixIdx - 1] : null;
  const follow = credit.followInterest === "" || credit.followInterest == null ? credit.interest : credit.followInterest;

  if (plan.stalled) {
    return (
      <div className="fc-detail-note">
        Mit einer Monatsrate von {eurFull(credit.rate)} und {String(credit.interest).replace(".", ",")} % Zinsen wächst die Restschuld –
        der Zinsanteil ist grösser als die Rate. Prüfe Rate oder Zinssatz.
      </div>
    );
  }

  return (
    <div>
      <div className="fc-detail-kpis">
        <div><span className="l">Laufzeit</span><span className="v">{monthsLabel(plan.months)}</span></div>
        <div><span className="l">Zinsen gesamt</span><span className="v">{eur(plan.totalInterest)}</span></div>
        {fixRow && (
          <>
            <div>
              <span className="l">Restschuld bei Bindungsende</span>
              <span className="v">{eur(fixRow.bal)}</span>
              <span className="l" style={{ marginTop: 1 }}>{fmtDay(credit.fixedUntil)}</span>
            </div>
            <div>
              <span className="l">Anschlusszins</span>
              <span className="v">{String(follow).replace(".", ",")} %</span>
              <span className="l" style={{ marginTop: 1 }}>Annahme</span>
            </div>
          </>
        )}
      </div>

      <div style={{ width: "100%", height: 200, marginTop: 10 }}>
        <ResponsiveContainer>
          <LineChart data={chart} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} minTickGap={28} />
            <YAxis width={58} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline}
              tickFormatter={(v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} Mio` : Math.round(v).toLocaleString(locale()))} />
            <Tooltip
              formatter={(v, n) => [eurFull(v), n]}
              labelFormatter={(l) => `Jahr ${l}`}
              contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 12.5, boxShadow: SHADOW }}
              labelStyle={{ color: C.muted }}
              itemStyle={{ color: C.ink }}
            />
            <Line type="monotone" dataKey="bal1" name="Zinsbindung" stroke={C.rausch} strokeWidth={2.4} dot={false} connectNulls={false} />
            {fixRow && <Line type="monotone" dataKey="bal2" name="nach Refinanzierung" stroke={C.luxe} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="fc-detail-sec">Pro Jahr</div>
      <div className="fc-planhead">
        <span>Jahr</span><span>Zinsen</span><span>Tilgung</span><span>Restschuld</span>
      </div>
      <div className="fc-plantable">
        {plan.years.map((y) => (
          <div className="fc-planrow" key={y.year}>
            <span>{y.year}</span>
            <span>{eur(y.interest)}</span>
            <span>{eur(y.principal)}</span>
            <span>{eur(y.bal)}</span>
          </div>
        ))}
      </div>
      <div className="fc-detail-note" style={{ marginTop: 12 }}>
        {fixRow
          ? `Bis ${fmtDay(credit.fixedUntil)} rechnet der Plan mit ${String(credit.interest).replace(".", ",")} %, danach mit ${String(follow).replace(".", ",")} % – der Anschlusszins ist eine Annahme, keine Zusage.`
          : "Ohne Zinsbindung rechnet der Plan durchgehend mit dem aktuellen Zinssatz. Trage die Zinsbindung ein, um die Restschuld bei Refinanzierung zu sehen."}
      </div>
    </div>
  );
}
