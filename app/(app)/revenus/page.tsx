"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO } from "../../components/api";

interface Rev {
  date: string;
  ca: number;
  margin_pct: number;
  note?: string;
}

export default function RevenusPage() {
  const [date, setDate] = useState(todayISO());
  const [ca, setCa] = useState("");
  const [margin, setMargin] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Rev[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await api<{ revenue: Rev[] }>("/api/revenue");
    setRows(r.revenue);
  }
  useEffect(() => {
    load();
  }, []);

  // Préremplit si une saisie existe pour la date.
  useEffect(() => {
    api<{ revenue: Rev | null }>(`/api/revenue?date=${date}`).then((r) => {
      if (r.revenue) {
        setCa(String(r.revenue.ca));
        setMargin(String(r.revenue.margin_pct));
        setNote(r.revenue.note || "");
      } else {
        setCa("");
        setMargin("");
        setNote("");
      }
    });
  }, [date]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/revenue", {
      method: "POST",
      body: JSON.stringify({
        date,
        ca: Number(ca),
        margin_pct: Number(margin),
        note,
      }),
    });
    setMsg("Enregistré ✓");
    setTimeout(() => setMsg(""), 1500);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Chiffre d'affaires & marge</h1>

      <form onSubmit={save} className="card grid md:grid-cols-4 gap-4">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">CA du jour (€)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={ca}
            onChange={(e) => setCa(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label">Marge commerciale (%)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="ex. 35"
          />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">Enregistrer</button>
        </div>
        <div className="md:col-span-4">
          <label className="label">Note (optionnel)</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {ca && margin && (
          <p className="md:col-span-4 text-sm text-slate-500">
            Marge commerciale estimée :{" "}
            <strong className="text-emerald-600">
              {eur((Number(ca) * Number(margin)) / 100)}
            </strong>
          </p>
        )}
        {msg && <p className="md:col-span-4 text-sm text-emerald-600">{msg}</p>}
      </form>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Derniers jours saisis</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b">
            <tr>
              <th className="cell">Date</th>
              <th className="cell">CA</th>
              <th className="cell">Marge %</th>
              <th className="cell">Marge €</th>
              <th className="cell">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.date}
                className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                onClick={() => setDate(r.date)}
              >
                <td className="cell font-medium">{r.date}</td>
                <td className="cell">{eur(r.ca)}</td>
                <td className="cell">{r.margin_pct}%</td>
                <td className="cell text-emerald-600">
                  {eur((r.ca * r.margin_pct) / 100)}
                </td>
                <td className="cell text-slate-400">{r.note}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="cell text-slate-400" colSpan={5}>
                  Aucune donnée. Commencez par saisir votre CA du jour.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
