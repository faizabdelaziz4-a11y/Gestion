"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO } from "../../components/api";
import { useBusiness, Business } from "../../components/BusinessContext";

interface Price {
  date: string;
  price: number;
}

export default function ReglagesPage() {
  const { active, businesses, refresh, setActive } = useBusiness();
  const [b, setB] = useState<Business | null>(null);
  const [ai, setAi] = useState(false);
  const [password, setPassword] = useState("");
  const [prices, setPrices] = useState<Price[]>([]);
  const [pf, setPf] = useState({ date: todayISO(), price: "" });
  const [msg, setMsg] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");

  useEffect(() => {
    if (active) setB({ ...active });
  }, [active]);

  async function loadAux() {
    const s = await api<{ aiEnabled: boolean }>("/api/settings");
    setAi(s.aiEnabled);
    const p = await api<{ prices: Price[] }>("/api/diesel-prices");
    setPrices(p.prices);
  }
  useEffect(() => {
    loadAux();
  }, []);

  if (!b) return <p>Chargement…</p>;
  const up = (k: keyof Business, v: any) => setB({ ...b, [k]: v });

  async function saveBusiness(e?: React.FormEvent) {
    e?.preventDefault();
    await api(`/api/businesses/${b!.id}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    });
    if (password) {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({ owner_password: password }),
      });
      setPassword("");
    }
    await refresh();
    setMsg("Réglages enregistrés ✓");
    setTimeout(() => setMsg(""), 1500);
  }

  async function deleteBusiness() {
    if (!confirm(`Supprimer définitivement « ${b!.name} » et toutes ses données ?`))
      return;
    try {
      await api(`/api/businesses/${b!.id}`, { method: "DELETE" });
      await refresh();
      const remaining = businesses.filter((x) => x.id !== b!.id)[0];
      if (remaining) setActive(remaining.id);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function regenToken() {
    const r = await api<{ business: Business }>(`/api/businesses/${b!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ regenerate_token: true }),
    });
    setB({ ...b!, ingest_token: r.business.ingest_token });
    refresh();
  }

  async function addPrice(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/diesel-prices", {
      method: "POST",
      body: JSON.stringify({ date: pf.date, price: Number(pf.price) }),
    });
    setPf({ ...pf, price: "" });
    loadAux();
  }

  async function fetchOfficial() {
    setFetching(true);
    setFetchMsg("");
    try {
      const r = await api<{ date: string; price: number; source: string; product: string }>(
        "/api/diesel-prices/fetch",
        { method: "POST" }
      );
      setFetchMsg(`Prix officiel : ${eur(r.price)}/L (${r.product}, ${r.date})`);
      loadAux();
    } catch (e: any) {
      setFetchMsg(e.message);
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Réglages — {b.name}</h1>
      </div>

      {/* Config du commerce actif */}
      <form onSubmit={saveBusiness} className="card grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2 font-semibold">Commerce</div>
        <div>
          <label className="label">Nom du commerce</label>
          <input className="input" value={b.name} onChange={(e) => up("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Région (prix diesel)</label>
          <input className="input" value={b.region} onChange={(e) => up("region", e.target.value)} />
        </div>
        <div>
          <label className="label">Heure d'ouverture</label>
          <input
            type="time"
            className="input"
            value={b.opening_time}
            onChange={(e) => up("opening_time", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Heure de fermeture</label>
          <input
            type="time"
            className="input"
            value={b.closing_time}
            onChange={(e) => up("closing_time", e.target.value)}
          />
        </div>

        <div className="md:col-span-2 font-semibold mt-2">Diesel</div>
        <div>
          <label className="label">Consommation (L / 100 km)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={b.diesel_consumption}
            onChange={(e) => up("diesel_consumption", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Prix diesel par défaut (€/L)</label>
          <input
            type="number"
            step="0.001"
            className="input"
            value={b.default_diesel_price}
            onChange={(e) => up("default_diesel_price", Number(e.target.value))}
          />
        </div>

        <div className="md:col-span-2 font-semibold mt-2">
          Taux paie (Belgique) — estimation paramétrable
        </div>
        <div>
          <label className="label">Cotisation patronale ONSS</label>
          <input
            type="number"
            step="0.0001"
            className="input"
            value={b.employer_onss_rate}
            onChange={(e) => up("employer_onss_rate", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Cotisation travailleur</label>
          <input
            type="number"
            step="0.0001"
            className="input"
            value={b.onss_worker_rate}
            onChange={(e) => up("onss_worker_rate", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Cotisation solidarité étudiant</label>
          <input
            type="number"
            step="0.0001"
            className="input"
            value={b.onss_student_rate}
            onChange={(e) => up("onss_student_rate", Number(e.target.value))}
          />
        </div>

        <div className="md:col-span-2 font-semibold mt-2">Sécurité (global)</div>
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

        {msg && <p className="md:col-span-2 text-emerald-600 text-sm">{msg}</p>}
        <div className="md:col-span-2 flex items-center gap-3">
          <button className="btn-primary">Enregistrer</button>
          {businesses.length > 1 && (
            <button type="button" className="btn-danger" onClick={deleteBusiness}>
              Supprimer ce commerce
            </button>
          )}
        </div>
      </form>

      {/* Ingestion API (caisse automatique / POS) */}
      <div className="card space-y-2">
        <h2 className="font-semibold">Caisse automatique / API (ingestion)</h2>
        <p className="text-sm text-slate-500">
          Jeton pour que ta caisse automatique (POS) ou un autre logiciel pousse le
          CA et le cash de ce commerce automatiquement.
        </p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-slate-100 rounded px-2 py-1 break-all flex-1">
            POST /api/ingest/{b.ingest_token}
          </code>
          <button type="button" className="btn-ghost text-xs" onClick={regenToken}>
            Régénérer
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Corps JSON : {`{ "date": "AAAA-MM-JJ", "ca": 1200, "margin_pct": 38, "cash_closing": 650 }`}
        </p>
      </div>

      {/* Assistant IA */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Assistant IA (lecture photo / import)</h2>
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
            ? "Lecture automatique des photos (compteur, planning) et mappage des imports activés."
            : "Définissez ANTHROPIC_API_KEY puis redémarrez pour activer l'IA. Sans clé, tout reste en saisie/mappage manuel."}
        </p>
      </div>

      {/* Prix diesel (global national) */}
      <div className="card">
        <h2 className="font-semibold mb-3">Prix du diesel (officiel national)</h2>
        <div className="bg-brand/5 border border-brand/20 rounded-lg p-3 mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <div className="font-medium text-brand">Prix officiel automatique</div>
            <div className="text-xs text-slate-500">
              Source : Statbel / SPF Économie — « {b.diesel_product} »
            </div>
            {fetchMsg && <div className="text-xs text-slate-600 mt-1">{fetchMsg}</div>}
          </div>
          <button type="button" className="btn-primary text-sm" onClick={fetchOfficial} disabled={fetching}>
            {fetching ? "Récupération…" : "Récupérer le prix du jour"}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-2">Ou saisie manuelle :</p>
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
                  Aucun prix saisi (le prix par défaut du commerce est utilisé).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
