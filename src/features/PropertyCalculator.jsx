import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Home, Receipt, Landmark, Wallet, Repeat, Percent, Check, ArrowDownWideNarrow, TrendingUp } from "lucide-react";
import { C, SHADOW, CURRENCIES } from "../lib/constants.jsx";
import { curSym, eur, eurFull } from "../lib/currency.js";
import { todayIso } from "../lib/utils.js";
import { BUNDESLAENDER, blOf, n, objektAnalyse } from "../lib/tax.js";
import { Btn, Field, NumInput, InfoNote, Kpi, Collapse } from "../components/ui.jsx";

/* ---------- Haupt-Komponente ---------- */
export default function PropertyCalculator({ settings, onAdopt, fxRates = { EUR: 1, USD: 1, CHF: 1 } }) {
  const [i, setI] = useState({
    price: "", state: settings.taxState || "bw", area: "", buildingPct: "",
    grestPct: "", notarPct: "", makler: false, maklerPct: "",
    equity: "", financeNk: false, zins: "", tilgung: "",
    rent: "", rentPerM2: "", rentGrowth: "", vacancy: "", propGrowth: "",
    costMode: "pauschal", opsPct: "", maintPerM2: "", maintYear: "", mgmtM: "", otherM: "",
    afaPct: "", horizon: "", flatRate: "",
  });
  const set = (patch) => setI((p) => ({ ...p, ...patch }));

  /* Steuerprofil lebt zentral in den Profil-Einstellungen. Gehalt kann in einer
     beliebigen Währung stehen (Grenzgänger) und wird über die Kurse in die
     Systemwährung umgerechnet, bevor der Tarif greift. */
  const sysCur = CURRENCIES.includes(settings.currency) ? settings.currency : "EUR";
  const incCcy = settings.taxIncomeCcy || sysCur;
  const incRaw = settings.taxIncome;
  const incConv = (incRaw === "" || incRaw == null)
    ? ""
    : (Number(incRaw) || 0) * (incCcy === sysCur ? 1 : (fxRates[incCcy] || 1));
  const prof = {
    taxIncome: incConv, splitting: !!settings.splitting,
    taxState: settings.taxState || i.state, church: !!settings.church,
    kids: settings.kids ?? "", birth: settings.birth || "",
  };

  const [open, setOpen] = useState({ obj: true, nk: false, fin: false, rent: false, assume: false, ops: false, afa: false, tax: false });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // eslint-disable-next-line react-hooks/exhaustive-deps -- prof ist aus settings/fxRates abgeleitet
  const a = useMemo(() => objektAnalyse(i, prof), [i, settings, fxRates]);
  const enough = n(i.price) > 0 && (n(i.rent) > 0 || (n(i.rentPerM2) > 0 && n(i.area) > 0));

  const bl = blOf(i.state);
  const vColor = a.verdict === "pos" ? C.positive : a.verdict === "neg" ? C.rausch : C.muted;
  const vLabel = a.verdict === "pos" ? "Cashflow-positiv" : a.verdict === "neg" ? "Zuzahlung nötig" : "Selbstträger";
  const cf = Math.round(a.cashAfterTaxM);

  const chart = a.rows.map((r) => ({ ...r }));
  const compact = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " Mio" : Math.round(v / 1e3) + "k");

  return (
    <div className="fc-form">
      {/* ---- Objekt ---- */}
      <Collapse title="Objekt & Kaufpreis" icon={Home} open={open.obj} onToggle={() => toggle("obj")}>
        <Field label={`Kaufpreis (${curSym()})`}>
          <NumInput value={i.price} onChange={(v) => set({ price: v })} placeholder="0" autoFocus />
        </Field>
        <div className="fc-row2">
          <Field label="Bundesland">
            <select value={i.state} onChange={(e) => set({ state: e.target.value })}>
              {BUNDESLAENDER.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Wohnfläche (m²)">
            <NumInput value={i.area} onChange={(v) => set({ area: v })} placeholder="optional" />
          </Field>
        </div>
      </Collapse>

      {/* ---- Kaufnebenkosten ---- */}
      <Collapse title={`Kaufnebenkosten · ${a.nkPct.toFixed(1).replace(".", ",")} %`} icon={Receipt} open={open.nk} onToggle={() => toggle("nk")}>
        <div className="fc-row2">
          <Field label="Grunderwerbsteuer (%)">
            <NumInput value={i.grestPct} onChange={(v) => set({ grestPct: v })} placeholder={bl ? String(bl.grest).replace(".", ",") : "5"} />
          </Field>
          <Field label="Notar & Grundbuch (%)">
            <NumInput value={i.notarPct} onChange={(v) => set({ notarPct: v })} placeholder="2" />
          </Field>
        </div>
        <button type="button" className="fc-check" onClick={() => set({ makler: !i.makler })}>
          <span className={`box ${i.makler ? "on" : ""}`}>{i.makler && <Check size={13} strokeWidth={3} />}</span>
          <span>Maklerprovision einrechnen</span>
        </button>
        {i.makler && (
          <Field label="Maklerprovision (%)">
            <NumInput value={i.maklerPct} onChange={(v) => set({ maklerPct: v })} placeholder="3,57" />
          </Field>
        )}
        <InfoNote>
          Grunderwerbsteuer ist für {bl ? bl.label : "das Bundesland"} vorbelegt ({(bl ? bl.grest : 5).toString().replace(".", ",")} %).
          Summe der Nebenkosten: <b>{eur(a.nk)}</b>.
        </InfoNote>
      </Collapse>

      {/* ---- Finanzierung ---- */}
      <Collapse title="Finanzierung" icon={Landmark} open={open.fin} onToggle={() => toggle("fin")}>
        <div className="fc-row2">
          <Field label={`Eigenkapital (${curSym()})`}>
            <NumInput value={i.equity} onChange={(v) => set({ equity: v })} placeholder="0" />
          </Field>
          <Field label="Sollzins (% p. a.)">
            <NumInput value={i.zins} onChange={(v) => set({ zins: v })} placeholder="z. B. 3,8" />
          </Field>
        </div>
        <Field label="Tilgung pro Jahr (%)">
          <NumInput value={i.tilgung} onChange={(v) => set({ tilgung: v })} placeholder="z. B. 2" />
        </Field>
        <InfoNote>
          Anteil der Darlehenssumme, der im Jahr getilgt wird – zusätzlich zum Zins. Zins + Tilgung ergeben zusammen deine monatliche Rate.
        </InfoNote>
        <button type="button" className="fc-check" onClick={() => set({ financeNk: !i.financeNk })}>
          <span className={`box ${i.financeNk ? "on" : ""}`}>{i.financeNk && <Check size={13} strokeWidth={3} />}</span>
          <span>Kaufnebenkosten mitfinanzieren</span>
        </button>
        <InfoNote>Darlehen: <b>{eur(a.loan0)}</b> · Annuität <b>{eur(a.annuityY / 12)}</b>/Monat</InfoNote>
      </Collapse>

      {/* ---- Miete ---- */}
      <Collapse title="Mieteinnahmen" icon={Wallet} open={open.rent} onToggle={() => toggle("rent")}>
        <div className="fc-row2">
          <Field label={`Kaltmiete/Monat (${curSym()})`}>
            <NumInput value={i.rent} onChange={(v) => set({ rent: v })} placeholder="0" />
          </Field>
          <Field label={`oder €/m²`}>
            <NumInput value={i.rentPerM2} onChange={(v) => set({ rentPerM2: v })} placeholder="optional" />
          </Field>
        </div>
      </Collapse>

      {/* ---- Annahmen über die Laufzeit ---- */}
      <Collapse title="Annahmen (optional)" icon={TrendingUp} open={open.assume} onToggle={() => toggle("assume")}>
        <div className="fc-row2">
          <Field label="Mietsteigerung (% p. a.)">
            <NumInput value={i.rentGrowth} onChange={(v) => set({ rentGrowth: v })} placeholder="0" />
          </Field>
          <Field label="Wertsteigerung (% p. a.)">
            <NumInput value={i.propGrowth} onChange={(v) => set({ propGrowth: v })} placeholder="0" />
          </Field>
        </div>
        <Field label="Mietausfall / Leerstand (% der Miete)">
          <NumInput value={i.vacancy} onChange={(v) => set({ vacancy: v })} placeholder="0" />
        </Field>
        <InfoNote>
          Standard 0 % = konservative Momentaufnahme. Mit Werten hier wachsen Miete und Objektwert im Verlauf; die Wertsteigerung wird beim Übernehmen ins Portfolio als Rate mitgenommen.
        </InfoNote>
      </Collapse>

      {/* ---- Nicht umlagefähige Kosten ---- */}
      <Collapse title="Nicht umlagefähige Kosten" icon={Repeat} open={open.ops} onToggle={() => toggle("ops")}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Btn kind={(i.costMode || "pauschal") === "pauschal" ? "primary" : "ghost"} onClick={() => set({ costMode: "pauschal" })} style={{ flex: 1 }}>Pauschal</Btn>
          <Btn kind={i.costMode === "detail" ? "primary" : "ghost"} onClick={() => set({ costMode: "detail" })} style={{ flex: 1 }}>Detailliert</Btn>
        </div>
        {(i.costMode || "pauschal") === "pauschal" ? (
          <>
            <Field label="Anteil der Kaltmiete (%)">
              <NumInput value={i.opsPct} onChange={(v) => set({ opsPct: v })} placeholder="25" />
            </Field>
            <InfoNote>
              Deckt Verwaltung, Instandhaltungsrücklage und Mietausfallwagnis in einem Wert ab (Richtwert 20–25 %) –
              aktuell <b>{eur(a.opsCashY / 12)}</b>/Monat. Für die exakte steuerliche Behandlung der Rücklage wechsle zu „Detailliert“.
            </InfoNote>
          </>
        ) : (
          <>
            <div className="fc-row2">
              <Field label="Instandhaltungsrücklage (€/m²/Jahr)">
                <NumInput value={i.maintPerM2} onChange={(v) => set({ maintPerM2: v })} placeholder="z. B. 10" />
              </Field>
              <Field label="oder pauschal/Jahr">
                <NumInput value={i.maintYear} onChange={(v) => set({ maintYear: v })} placeholder="optional" />
              </Field>
            </div>
            <div className="fc-row2">
              <Field label="Verwaltung (€/Monat)">
                <NumInput value={i.mgmtM} onChange={(v) => set({ mgmtM: v })} placeholder="z. B. 25" />
              </Field>
              <Field label="Sonstige nicht umlagefähige (€/Monat)">
                <NumInput value={i.otherM} onChange={(v) => set({ otherM: v })} placeholder="0" />
              </Field>
            </div>
            <InfoNote>
              Die Instandhaltungsrücklage mindert den Cashflow, ist steuerlich aber erst bei tatsächlicher Ausgabe absetzbar –
              deshalb zählt sie hier nicht zu den Werbungskosten. Verwaltung und sonstige laufende Kosten mindern Cashflow und Steuer.
            </InfoNote>
          </>
        )}
      </Collapse>

      {/* ---- AfA ---- */}
      <Collapse title={`Abschreibung (AfA)`} icon={Percent} open={open.afa} onToggle={() => toggle("afa")}>
        <Field label="Gebäudeanteil (%) – nur dieser ist abschreibbar">
          <NumInput value={i.buildingPct} onChange={(v) => set({ buildingPct: v })} placeholder="80" />
        </Field>
        <Field label="AfA-Satz (% pro Jahr)">
          <NumInput value={i.afaPct} onChange={(v) => set({ afaPct: v })} placeholder="2" />
        </Field>
        <InfoNote>
          Standard 2 % (Baujahr ab 1925), 2,5 % Altbau, 3 % Neubau ab 2023. Bemessung = Gebäudeanteil × Gesamtinvestition =
          <b> {eur(a.afaBase)}</b> → AfA <b>{eur(a.afaY)}</b>/Jahr.
        </InfoNote>
      </Collapse>

      {/* ---- Steuer ---- */}
      <Collapse title="Steuer" icon={Percent} open={open.tax} onToggle={() => toggle("tax")}>
        {a.hasIncome ? (
          <InfoNote>
            Die Steuer wird aus deinem Profil berechnet (Einkommen, Splitting, Kirche, Kinder). Ändern kannst du das im Tab <b>Profil</b>.
          </InfoNote>
        ) : (
          <>
            <Field label="Grenzsteuersatz (grob, %)">
              <NumInput value={i.flatRate} onChange={(v) => set({ flatRate: v })} placeholder="42" />
            </Field>
            <InfoNote>
              Für die exakte Berechnung (Tarif 2026 inkl. Splitting, Kirche, Soli, Kinderfreibeträge) hinterlege dein zu versteuerndes
              Einkommen im Tab <b>Profil</b>. Ohne Angabe rechnet die App mit dem groben Grenzsteuersatz oben.
            </InfoNote>
          </>
        )}
      </Collapse>

      {/* ================= ERGEBNIS ================= */}
      {!enough ? (
        <InfoNote>Trage mindestens Kaufpreis und Kaltmiete ein – dann erscheint das Ergebnis. Alles Weitere macht es nur genauer.</InfoNote>
      ) : (
        <>
          <div style={{ background: a.verdict === "pos" ? "rgba(31,122,77,0.10)" : a.verdict === "neg" ? "rgba(255,56,92,0.10)" : C.soft, borderRadius: 16, padding: 18, textAlign: "center", margin: "6px 0 14px" }}>
            <div style={{ fontSize: 12.5, color: vColor, marginBottom: 2 }}>Cashflow nach Steuer</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: vColor, lineHeight: 1.1 }}>
              {cf > 0 ? "+" : ""}{eur(cf)}<span style={{ fontSize: 15, fontWeight: 500 }}> /Monat</span>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 9, background: vColor, color: "#fff", fontSize: 12.5, padding: "4px 13px", borderRadius: 20 }}>
              {a.verdict === "pos" ? <Check size={13} strokeWidth={3} /> : a.verdict === "neg" ? <ArrowDownWideNarrow size={13} /> : <Repeat size={13} />}
              {vLabel}
            </span>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>
              vor Steuer {eur(a.cashBeforeTaxM)}/M · Steuereffekt {a.steuerJ1 <= 0 ? "+" : "−"}{eur(Math.abs(a.steuerJ1 / 12))}/M
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Kpi label="Bruttorendite" value={`${a.grossYield.toFixed(1).replace(".", ",")} %`} />
            <Kpi label="Kaufpreisfaktor" value={a.factor.toFixed(1).replace(".", ",")} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Kpi label="Nettorendite" value={`${a.netYield.toFixed(1).replace(".", ",")} %`} />
            <Kpi label="EK-Rendite" value={a.equity > 0 ? `${a.equityYield.toFixed(1).replace(".", ",")} %` : "–"} color={a.equityYield >= 0 ? C.positive : C.rausch} />
          </div>

          {/* Verlaufs-Chart: Vermögensaufbau */}
          <div className="fc-detail-sec">Vermögensaufbau über {a.horizon} Jahre</div>
          <div style={{ width: "100%", height: 210, marginTop: 6 }}>
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={C.hairlineSoft} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} tickFormatter={(y) => `${y}J`} minTickGap={22} />
                <YAxis width={48} tick={{ fontSize: 10.5, fill: C.mutedSoft }} stroke={C.hairline} tickFormatter={compact} />
                <Tooltip
                  formatter={(v, name) => [eurFull(v), name]}
                  labelFormatter={(y) => `Jahr ${y}`}
                  contentStyle={{ background: C.canvas, border: `1px solid ${C.hairline}`, borderRadius: 8, color: C.ink, fontSize: 12.5, boxShadow: SHADOW }}
                  labelStyle={{ color: C.muted }}
                />
                <Line type="monotone" dataKey="wert" name="Objektwert" stroke={C.luxe} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rest" name="Restschuld" stroke={C.rausch} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="equity" name="Eigenkapital" stroke={C.positive} strokeWidth={2.4} dot={false} />
                <Line type="monotone" dataKey="kum" name="Kum. Cashflow" stroke={C.muted} strokeWidth={1.6} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <InfoNote>
            Ab dem 10. Jahr ist ein Verkauf i. d. R. steuerfrei (Spekulationsfrist). Zahlen sind eine Schätzung, keine Steuerberatung.
          </InfoNote>

          <div style={{ marginTop: 16 }}>
            <Btn
              onClick={() => onAdopt({
                type: "immobilie", name: i.state ? `Objekt ${blOf(i.state)?.label || ""}`.trim() : "Immobilie",
                buyPrice: Math.round(a.price), price: Math.round(a.price),
                buyDate: todayIso(), valMode: n(i.propGrowth) ? "rate" : "value",
                growth: n(i.propGrowth), symbol: "", qty: 1, inChart: true,
              })}
            >
              Als Objekt ins Portfolio übernehmen
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
