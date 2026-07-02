"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO } from "../../components/api";

interface Cash {
  date: string;
  opening: number;
  expected_cash: number;
  closing: number;
  note: string | null;
  recette: number;
  ecart: number;
}

export default function CaissePage() {
  const [date, setDate] = useState(todayISO());
  const [f, setF] = useState({ opening: "", expected_cash: "", closing: "", note: "" });
  const [rows, setRows] = useState<Cash[]>([]);
  const [caRef, setCaRef] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  async function loadList() {
    const r = await api<{ cash: Cash[] }>("/api/cash");
    setRows(r.cash);
  }
  useEffect(() => {
    loadList();
  }, []);

  // Préremplit la saisie existante + CA du jour à titre de référence.
  useEffect(() => {
    api<{ cash: Cash | null }>(`/api/cash?date=${date}`).then((r) => {
      if (r.cash) {
        setF({
          opening: String(r.cash.opening),
          expected_cash: String(r.cash.expected_cash),
          closing: String(r.cash.closing),
          note: r.cash.note || "",
        });
      } else {
        setF({ opening: "", expected_cash: "", closing: "", note: "" });
      }
    });
    api<{ revenue: { ca: number } | null }>(`/api/revenue?date=${date}`).then((r) =>
      setCaRef(r.revenue ? r.revenue.ca : null)
    );
  }, [date]);

  const recette = (Number(f.closing) || 0) - (Number(f.opening) || 0);
  const ecart = recette - (Number(f.expected_cash) || 0);
  const ok = Math.abs(ecart) < 0.01;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/cash", {
      method: "POST",
      body: JSON.stringify({
        date,
        opening: Number(f.opening),
        expected_cash: Number(f.expected_cash),
        closing: Number(f.closing),
        note: f.note,
      }),
    });
    setMsg("Caisse enregistrée ✓");
    setTimeout(() => setMsg(""), 1500);
    loadList();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contrôle de caisse</h1>
      <p className="text-sm text-slate-500">
        Saisissez le fond de caisse en début et le cash compté en fin de soirée
        pour vérifier si le cash est correct.
      </p>

      <form onSubmit={save} className="card grid md:grid-cols-3 gap-4">
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
          <label className="label">Fond de caisse (début) €</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={f.opening}
            onChange={(e) => setF({ ...f, opening: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label">
            Ventes espèces attendues €
            {caRef != null && (
              <span className="text-slate-400"> (CA du jour : {eur(caRef)})</span>
            )}
          </label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={f.expected_cash}
            onChange={(e) => setF({ ...f, expected_cash: e.target.value })}
            placeholder="cash encaissé attendu"
          />
        </div>
        <div>
          <label className="label">Caisse comptée (fin de soirée) €</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={f.closing}
            onChange={(e) => setF({ ...f, closing: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Note</label>
          <input
            className="input"
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
          />
        </div>

        {/* Résultat du contrôle */}
        <div
          className={`md:col-span-3 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 ${
            ok
              ? "bg-emerald-50 border border-emerald-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <div className="text-sm">
            <div className="text-slate-500">Recette cash réelle (fin − début)</div>
            <div className="text-lg font-semibold">{eur(recette)}</div>
          </div>
          <div className="text-sm text-right">
            <div className="text-slate-500">Écart de caisse</div>
            <div
              className={`text-2xl font-bold ${
                ok ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {ecart > 0 ? "+" : ""}
              {eur(ecart)}
            </div>
            <div className="text-xs">
              {ok
                ? "Caisse correcte ✓"
                : ecart > 0
                ? "Surplus de caisse"
                : "Manque en caisse"}
            </div>
          </div>
        </div>

        <div className="md:col-span-3 flex items-center gap-3">
          <button className="btn-primary">Enregistrer</button>
          {msg && <span className="text-emerald-600 text-sm">{msg}</span>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Historique</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b">
            <tr>
              <th className="cell">Date</th>
              <th className="cell">Début</th>
              <th className="cell">Attendu</th>
              <th className="cell">Fin</th>
              <th className="cell">Recette</th>
              <th className="cell">Écart</th>
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
                <td className="cell">{eur(r.opening)}</td>
                <td className="cell">{eur(r.expected_cash)}</td>
                <td className="cell">{eur(r.closing)}</td>
                <td className="cell">{eur(r.recette)}</td>
                <td
                  className={`cell font-semibold ${
                    Math.abs(r.ecart) < 0.01
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {r.ecart > 0 ? "+" : ""}
                  {eur(r.ecart)}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="cell text-slate-400" colSpan={6}>
                  Aucun contrôle de caisse enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
