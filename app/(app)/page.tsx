"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO } from "../components/api";

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
  const maxAbs = Math.max(
    1,
    ...(data?.days || []).map((d) => Math.abs(d.netProfit))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  period === p ? "bg-white shadow-sm" : "text-slate-500"
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

      {/* Indicateur principal bénéfice / perte */}
      <div
        className={`card flex flex-wrap items-center justify-between gap-4 ${
          profit >= 0 ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-red-500"
        }`}
      >
        <div>
          <div className="text-xs uppercase text-slate-500 font-medium">
            Bénéfice net {profit >= 0 ? "" : "(perte)"}
          </div>
          <div
            className={`text-3xl font-bold ${
              profit >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {eur(profit)}
          </div>
          <div className="text-xs text-slate-400">
            {data?.start} → {data?.end}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Marge commerciale</div>
          <div className="text-xl font-semibold">{eur(t?.grossMargin ?? 0)}</div>
          <div className="text-xs text-slate-400">
            CA {eur(t?.ca ?? 0)} · Coûts {eur(t?.totalCosts ?? 0)}
          </div>
        </div>
      </div>

      {/* KPIs détaillés */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Chiffre d'affaires" value={eur(t?.ca ?? 0)} />
        <Kpi label="Main d'œuvre" value={eur(t?.labor ?? 0)} tone="cost" />
        <Kpi label="Diesel livreurs" value={eur(t?.diesel ?? 0)} tone="cost" />
        <Kpi
          label="Charges fixes"
          value={eur(t?.fixedCharges ?? 0)}
          tone="cost"
        />
        <Kpi
          label="Charges variables"
          value={eur(t?.variableCharges ?? 0)}
          tone="cost"
        />
        <Kpi label="Suppléments" value={eur(t?.supplements ?? 0)} tone="cost" />
        <Kpi label="Total coûts" value={eur(t?.totalCosts ?? 0)} tone="cost" />
        <Kpi
          label="Marge commerciale"
          value={eur(t?.grossMargin ?? 0)}
          tone="good"
        />
      </div>

      {/* Graphique bénéfice par jour */}
      <div className="card">
        <h2 className="font-semibold mb-4">Bénéfice net par jour</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {(data?.days || []).map((d) => {
              const h = (Math.abs(d.netProfit) / maxAbs) * 100;
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center justify-end group relative"
                  title={`${d.date}: ${eur(d.netProfit)}`}
                >
                  <div
                    className={`w-full rounded-t ${
                      d.netProfit >= 0 ? "bg-emerald-400" : "bg-red-400"
                    }`}
                    style={{ height: `${Math.max(2, h)}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Détail journalier */}
      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Détail journalier</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b">
            <tr>
              <th className="cell">Date</th>
              <th className="cell">CA</th>
              <th className="cell">Marge</th>
              <th className="cell">M.O.</th>
              <th className="cell">Diesel</th>
              <th className="cell">Charges</th>
              <th className="cell">Bénéfice</th>
            </tr>
          </thead>
          <tbody>
            {(data?.days || []).map((d) => (
              <tr key={d.date} className="border-b border-slate-100">
                <td className="cell font-medium">{d.date}</td>
                <td className="cell">{eur(d.ca)}</td>
                <td className="cell">{eur(d.grossMargin)}</td>
                <td className="cell text-slate-500">{eur(d.labor)}</td>
                <td className="cell text-slate-500">{eur(d.diesel)}</td>
                <td className="cell text-slate-500">
                  {eur(d.fixedCharges + d.variableCharges + d.supplements)}
                </td>
                <td
                  className={`cell font-semibold ${
                    d.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {eur(d.netProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "cost" | "good";
}) {
  return (
    <div className="card py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-lg font-semibold ${
          tone === "cost"
            ? "text-slate-700"
            : tone === "good"
            ? "text-emerald-600"
            : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
