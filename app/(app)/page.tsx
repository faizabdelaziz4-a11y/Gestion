"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO } from "../components/api";
import { ProfitChart, CostBar } from "../components/Charts";

type Period = "day" | "week" | "month";

interface Day {
  date: string;
  ca: number;
  grossMargin: number;
  labor: number;
  diesel: number;
  fixedCharges: number;
  variableCharges: number;
  supplements: number;
  platformFee: number;
  totalCosts: number;
  netProfit: number;
}
interface Summary {
  period: Period;
  start: string;
  end: string;
  totals: Omit<Day, "date">;
  days: Day[];
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Summary>(`/api/summary?period=${period}&date=${date}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [period, date]);

  const t = data?.totals;
  const profit = t?.netProfit ?? 0;
  const ca = t?.ca ?? 0;
  const margin = ca > 0 ? (profit / ca) * 100 : 0;
  const activeDays = (data?.days || []).filter((d) => d.ca > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.start} → ${data.end}` : "…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  period === p ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {p === "day" ? "Jour" : p === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
          <input
            type="date"
            className="input w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Hero + résumé */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="card lg:col-span-2 flex flex-col justify-between"
          style={{
            background:
              profit >= 0
                ? "linear-gradient(135deg,#ecfdf5,#ffffff 60%)"
                : "linear-gradient(135deg,#fef2f2,#ffffff 60%)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="badge"
              style={{
                background: profit >= 0 ? "#dcfce7" : "#fee2e2",
                color: profit >= 0 ? "var(--good-ink)" : "#b91c1c",
              }}
            >
              {profit >= 0 ? "● Bénéfice" : "● Perte"}
            </span>
            <span className="text-xs text-slate-500">
              sur {period === "day" ? "la journée" : period === "week" ? "la semaine" : "le mois"}
            </span>
          </div>
          <div className="my-3">
            <div
              className="text-4xl font-bold tracking-tight tnum"
              style={{ color: profit >= 0 ? "var(--good-ink)" : "#b91c1c" }}
            >
              {eur(profit)}
            </div>
            <div className="text-sm text-slate-500 tnum">
              Marge nette {margin.toFixed(1)} % · {activeDays} jour(s) d'activité
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-3">
            <MiniStat label="Chiffre d'affaires" value={eur(ca)} />
            <MiniStat label="Marge commerciale" value={eur(t?.grossMargin ?? 0)} accent="good" />
            <MiniStat label="Total des coûts" value={eur(t?.totalCosts ?? 0)} />
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Structure des coûts</h2>
          <CostBar
            labor={t?.labor ?? 0}
            diesel={t?.diesel ?? 0}
            fixedCharges={t?.fixedCharges ?? 0}
            variableCharges={t?.variableCharges ?? 0}
            platformFee={t?.platformFee ?? 0}
            supplements={t?.supplements ?? 0}
          />
        </div>
      </div>

      {/* Graphique bénéfice */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Bénéfice net par jour</h2>
          {loading && <span className="text-xs text-slate-400">Chargement…</span>}
        </div>
        <ProfitChart days={data?.days || []} />
      </div>

      {/* Détail journalier */}
      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Détail journalier</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="cell">Date</th>
              <th className="cell text-right">CA</th>
              <th className="cell text-right">Marge</th>
              <th className="cell text-right">M.O.</th>
              <th className="cell text-right">Diesel</th>
              <th className="cell text-right">Charges</th>
              <th className="cell text-right">Bénéfice</th>
            </tr>
          </thead>
          <tbody>
            {(data?.days || []).map((d) => (
              <tr key={d.date} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="cell font-medium">{d.date}</td>
                <td className="cell text-right tnum">{eur(d.ca)}</td>
                <td className="cell text-right tnum">{eur(d.grossMargin)}</td>
                <td className="cell text-right tnum text-slate-500">{eur(d.labor)}</td>
                <td className="cell text-right tnum text-slate-500">{eur(d.diesel)}</td>
                <td className="cell text-right tnum text-slate-500">
                  {eur(d.fixedCharges + d.variableCharges + d.supplements + d.platformFee)}
                </td>
                <td
                  className="cell text-right font-semibold tnum"
                  style={{ color: d.netProfit >= 0 ? "var(--good-ink)" : "#b91c1c" }}
                >
                  {eur(d.netProfit)}
                </td>
              </tr>
            ))}
            {!data?.days.length && (
              <tr>
                <td className="cell text-slate-400" colSpan={7}>
                  Aucune donnée sur la période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "good";
}) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div
        className="text-base font-semibold tnum"
        style={{ color: accent === "good" ? "var(--good-ink)" : "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}
