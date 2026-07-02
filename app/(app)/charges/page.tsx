"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO } from "../../components/api";

interface Charge {
  id: number;
  label: string;
  category: string;
  kind: string;
  amount: number;
  period: string;
  date: string | null;
}

const CATEGORIES = [
  "electricite",
  "gaz",
  "eau",
  "loyer",
  "comptable",
  "assurance",
  "marchandises",
  "telecom",
  "entretien",
  "autre",
];
const PERIODS = [
  { v: "journalier", l: "par jour" },
  { v: "hebdomadaire", l: "par semaine" },
  { v: "mensuel", l: "par mois" },
  { v: "annuel", l: "par an" },
  { v: "ponctuel", l: "ponctuel (1 date)" },
];

// Coût journalier indicatif d'une charge.
function perDay(c: Charge): number {
  switch (c.period) {
    case "journalier":
      return c.amount;
    case "hebdomadaire":
      return c.amount / 7;
    case "mensuel":
      return c.amount / 30.42;
    case "annuel":
      return c.amount / 365;
    default:
      return 0;
  }
}

export default function ChargesPage() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [f, setF] = useState({
    label: "",
    category: "electricite",
    kind: "fixe",
    amount: "",
    period: "mensuel",
    date: todayISO(),
  });

  async function load() {
    const r = await api<{ charges: Charge[] }>("/api/charges");
    setCharges(r.charges);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/charges", {
      method: "POST",
      body: JSON.stringify({ ...f, amount: Number(f.amount) }),
    });
    setF({ ...f, label: "", amount: "" });
    load();
  }

  const totalDay = charges.reduce((s, c) => s + perDay(c), 0);
  const fixed = charges.filter((c) => c.kind === "fixe");
  const variable = charges.filter((c) => c.kind === "variable");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Charges (frais)</h1>

      <form onSubmit={add} className="card grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="label">Libellé</label>
          <input
            className="input"
            value={f.label}
            onChange={(e) => setF({ ...f, label: e.target.value })}
            placeholder="ex. Électricité, Comptable, Loyer…"
            required
          />
        </div>
        <div>
          <label className="label">Montant (€)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Catégorie</label>
          <select
            className="input"
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={f.kind}
            onChange={(e) => setF({ ...f, kind: e.target.value })}
          >
            <option value="fixe">Fixe</option>
            <option value="variable">Variable</option>
          </select>
        </div>
        <div>
          <label className="label">Fréquence</label>
          <select
            className="input"
            value={f.period}
            onChange={(e) => setF({ ...f, period: e.target.value })}
          >
            {PERIODS.map((p) => (
              <option key={p.v} value={p.v}>
                {p.l}
              </option>
            ))}
          </select>
        </div>
        {f.period === "ponctuel" && (
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
            />
          </div>
        )}
        <button className="btn-primary md:col-span-3">Ajouter la charge</button>
      </form>

      <div className="card flex items-center justify-between">
        <span className="text-slate-500">Coût des charges réparti par jour</span>
        <span className="text-xl font-bold text-brand">{eur(totalDay)}/jour</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChargeList title="Charges fixes" items={fixed} onChange={load} />
        <ChargeList title="Charges variables" items={variable} onChange={load} />
      </div>
    </div>
  );
}

function ChargeList({
  title,
  items,
  onChange,
}: {
  title: string;
  items: Charge[];
  onChange: () => void;
}) {
  return (
    <div className="card">
      <h2 className="font-semibold mb-3">{title}</h2>
      <ul className="space-y-2 text-sm">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between border-b border-slate-100 pb-2"
          >
            <div>
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-slate-400">
                {c.category} · {PERIODS.find((p) => p.v === c.period)?.l}
                {c.date && c.period === "ponctuel" ? ` · ${c.date}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{eur(c.amount)}</span>
              <button
                className="text-red-500 hover:underline text-xs"
                onClick={async () => {
                  await api(`/api/charges/${c.id}`, { method: "DELETE" });
                  onChange();
                }}
              >
                Suppr.
              </button>
            </div>
          </li>
        ))}
        {!items.length && <li className="text-slate-400">Aucune charge.</li>}
      </ul>
    </div>
  );
}
