"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO } from "../../components/api";

interface Settings {
  business_name: string;
  diesel_consumption: string;
  default_diesel_price: string;
  employer_onss_rate: string;
  onss_worker_rate: string;
  onss_student_rate: string;
  region: string;
}

interface Price {
  date: string;
  price: number;
}

export default function ReglagesPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [ai, setAi] = useState(false);
  const [password, setPassword] = useState("");
  const [prices, setPrices] = useState<Price[]>([]);
  const [pf, setPf] = useState({ date: todayISO(), price: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await api<{ settings: Settings; aiEnabled: boolean }>("/api/settings");
    setS(r.settings);
    setAi(r.aiEnabled);
    const p = await api<{ prices: Price[] }>("/api/diesel-prices");
    setPrices(p.prices);
  }
  useEffect(() => {
    load();
  }, []);

  if (!s) return <p>Chargement…</p>;
  const up = (k: keyof Settings, v: string) => setS({ ...s, [k]: v });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...s };
    if (password) payload.owner_password = password;
    await api("/api/settings", { method: "POST", body: JSON.stringify(payload) });
    setPassword("");
    setMsg("Réglages enregistrés ✓");
    setTimeout(() => setMsg(""), 1500);
  }

  async function addPrice(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/diesel-prices", {
      method: "POST",
      body: JSON.stringify({ date: pf.date, price: Number(pf.price) }),
    });
    setPf({ ...pf, price: "" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Réglages</h1>

      <form onSubmit={save} className="card grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2 font-semibold">Entreprise</div>
        <div>
          <label className="label">Nom du commerce</label>
          <input className="input" value={s.business_name} onChange={(e) => up("business_name", e.target.value)} />
        </div>
        <div>
          <label className="label">Région (prix diesel)</label>
          <input className="input" value={s.region} onChange={(e) => up("region", e.target.value)} />
        </div>
        <div>
          <label className="label">Nouveau mot de passe propriétaire</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="laisser vide pour ne pas changer"
          />
        </div>

        <div className="md:col-span-2 font-semibold mt-2">Diesel</div>
        <div>
          <label className="label">Consommation (L / 100 km)</label>
          <input className="input" value={s.diesel_consumption} onChange={(e) => up("diesel_consumption", e.target.value)} />
        </div>
        <div>
          <label className="label">Prix diesel par défaut (€/L)</label>
          <input className="input" value={s.default_diesel_price} onChange={(e) => up("default_diesel_price", e.target.value)} />
        </div>

        <div className="md:col-span-2 font-semibold mt-2">
          Taux paie (Belgique) — estimation paramétrable
        </div>
        <div>
          <label className="label">Cotisation patronale ONSS (ex. 0.25)</label>
          <input className="input" value={s.employer_onss_rate} onChange={(e) => up("employer_onss_rate", e.target.value)} />
        </div>
        <div>
          <label className="label">Cotisation travailleur (ex. 0.1307)</label>
          <input className="input" value={s.onss_worker_rate} onChange={(e) => up("onss_worker_rate", e.target.value)} />
        </div>
        <div>
          <label className="label">Cotisation solidarité étudiant (ex. 0.0271)</label>
          <input className="input" value={s.onss_student_rate} onChange={(e) => up("onss_student_rate", e.target.value)} />
        </div>

        {msg && <p className="md:col-span-2 text-emerald-600 text-sm">{msg}</p>}
        <div className="md:col-span-2">
          <button className="btn-primary">Enregistrer les réglages</button>
        </div>
      </form>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Assistant IA (lecture photo)</h2>
          <span
            className={`badge ${
              ai ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
            }`}
          >
            {ai ? "Activé" : "Désactivé"}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {ai
            ? "La lecture automatique du compteur kilométrique et l'import d'horaire par photo sont actifs."
            : "Pour activer la lecture automatique des photos (compteur, planning), définissez la variable d'environnement ANTHROPIC_API_KEY puis redémarrez. Sans clé, la saisie reste manuelle."}
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Prix du diesel à {s.region} (journalier)</h2>
        <form onSubmit={addPrice} className="grid grid-cols-3 gap-2 mb-4">
          <input type="date" className="input" value={pf.date} onChange={(e) => setPf({ ...pf, date: e.target.value })} />
          <input
            type="number"
            step="0.001"
            className="input"
            placeholder="€/L"
            value={pf.price}
            onChange={(e) => setPf({ ...pf, price: e.target.value })}
          />
          <button className="btn-primary">Enregistrer le prix</button>
        </form>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b">
            <tr>
              <th className="cell">Date</th>
              <th className="cell">Prix €/L</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => (
              <tr key={p.date} className="border-b border-slate-100">
                <td className="cell">{p.date}</td>
                <td className="cell">{eur(p.price)}</td>
              </tr>
            ))}
            {!prices.length && (
              <tr>
                <td className="cell text-slate-400" colSpan={2}>
                  Aucun prix saisi (le prix par défaut est utilisé).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
