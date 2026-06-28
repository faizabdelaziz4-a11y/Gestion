"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO, POSTES, STATUTS } from "../../components/api";

interface Worker {
  id: number;
  name: string;
  poste: string;
  statut: string;
  pay_type: string;
  pay_basis: string;
  base_rate: number;
  access_code: string;
  active: number;
}

interface Breakdown {
  brut: number;
  net: number;
  onssWorker: number;
  precompte: number;
  employerOnss: number;
  employerCost: number;
}

export default function TravailleursPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [editing, setEditing] = useState<Worker | null>(null);

  async function load() {
    const r = await api<{ workers: Worker[] }>("/api/workers");
    setWorkers(r.workers);
  }
  useEffect(() => {
    load();
  }, []);

  const blank: Partial<Worker> = {
    name: "",
    poste: "vendeur",
    statut: "employe",
    pay_type: "hourly",
    pay_basis: "net",
    base_rate: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Travailleurs</h1>
        <button className="btn-primary" onClick={() => setEditing(blank as Worker)}>
          + Ajouter
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {workers
          .filter((w) => w.active)
          .map((w) => (
            <WorkerCard key={w.id} w={w} onEdit={() => setEditing(w)} onChange={load} />
          ))}
        {!workers.filter((w) => w.active).length && (
          <p className="text-slate-400 text-sm">
            Aucun travailleur. Cliquez sur « Ajouter ».
          </p>
        )}
      </div>

      {workers.some((w) => !w.active) && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-slate-500">
            Travailleurs archivés
          </summary>
          <ul className="mt-3 space-y-1 text-sm">
            {workers
              .filter((w) => !w.active)
              .map((w) => (
                <li key={w.id} className="flex justify-between">
                  <span>
                    {w.name} — {w.poste}
                  </span>
                  <button
                    className="text-brand hover:underline"
                    onClick={async () => {
                      await api(`/api/workers/${w.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ active: 1 }),
                      });
                      load();
                    }}
                  >
                    Réactiver
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}

      {editing && (
        <WorkerForm
          worker={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function WorkerCard({
  w,
  onEdit,
  onChange,
}: {
  w: Worker;
  onEdit: () => void;
  onChange: () => void;
}) {
  const [bd, setBd] = useState<Breakdown | null>(null);
  const [suppOpen, setSuppOpen] = useState(false);

  useEffect(() => {
    // Aperçu mensuel : pour un horaire on simule 152 h/mois à titre indicatif.
    const amount = w.pay_type === "monthly" ? w.base_rate : w.base_rate * 152;
    api<{ breakdown: Breakdown }>(
      `/api/payroll?amount=${amount}&statut=${w.statut}&basis=${w.pay_basis}`
    ).then((r) => setBd(r.breakdown));
  }, [w]);

  const statutLabel = STATUTS.find((s) => s.value === w.statut)?.label || w.statut;

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-lg">{w.name}</div>
          <div className="text-xs text-slate-500">
            {w.poste} · {statutLabel}
          </div>
        </div>
        <span className="badge bg-slate-100 text-slate-600">
          Code : {w.access_code}
        </span>
      </div>

      <div className="text-sm">
        <span className="text-slate-500">Rémunération : </span>
        <strong>
          {eur(w.base_rate)}
          {w.pay_type === "hourly" ? " /h" : " /mois"}
        </strong>{" "}
        <span className="text-slate-400">({w.pay_basis})</span>
      </div>

      {bd && w.statut !== "independant" && (
        <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 rounded-lg p-3">
          <div>
            <div className="text-slate-400">Net (estim.)</div>
            <div className="font-semibold">{eur(bd.net)}</div>
          </div>
          <div>
            <div className="text-slate-400">Brut</div>
            <div className="font-semibold">{eur(bd.brut)}</div>
          </div>
          <div>
            <div className="text-slate-400">Coût total</div>
            <div className="font-semibold text-brand">{eur(bd.employerCost)}</div>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button className="btn-ghost text-xs" onClick={onEdit}>
          Modifier
        </button>
        <button
          className="btn-ghost text-xs"
          onClick={() => setSuppOpen((v) => !v)}
        >
          + Supplément
        </button>
        <button
          className="btn-danger text-xs"
          onClick={async () => {
            if (confirm(`Archiver ${w.name} ?`)) {
              await api(`/api/workers/${w.id}`, { method: "DELETE" });
              onChange();
            }
          }}
        >
          Retirer
        </button>
      </div>

      {suppOpen && <SupplementForm workerId={w.id} onDone={() => setSuppOpen(false)} />}
    </div>
  );
}

function SupplementForm({
  workerId,
  onDone,
}: {
  workerId: number;
  onDone: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  return (
    <form
      className="grid grid-cols-3 gap-2 bg-amber-50 rounded-lg p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await api("/api/supplements", {
          method: "POST",
          body: JSON.stringify({
            worker_id: workerId,
            date,
            amount: Number(amount),
            label,
          }),
        });
        onDone();
      }}
    >
      <input
        type="date"
        className="input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <input
        type="number"
        step="0.01"
        className="input"
        placeholder="Montant €"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        className="input"
        placeholder="Motif"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button className="btn-primary col-span-3 text-xs">Ajouter le supplément</button>
    </form>
  );
}

function WorkerForm({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Worker>({ ...worker });
  const [bd, setBd] = useState<Breakdown | null>(null);
  const [err, setErr] = useState("");
  const isNew = !worker.id;

  // Simulateur en direct.
  useEffect(() => {
    const amount = f.pay_type === "monthly" ? f.base_rate : f.base_rate * 152;
    api<{ breakdown: Breakdown }>(
      `/api/payroll?amount=${amount}&statut=${f.statut}&basis=${f.pay_basis}`
    ).then((r) => setBd(r.breakdown));
  }, [f.base_rate, f.statut, f.pay_basis, f.pay_type]);

  const up = (k: keyof Worker, v: any) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      if (isNew) {
        await api("/api/workers", { method: "POST", body: JSON.stringify(f) });
      } else {
        await api(`/api/workers/${f.id}`, {
          method: "PATCH",
          body: JSON.stringify(f),
        });
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <form
        className="card w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <h2 className="text-lg font-bold">
          {isNew ? "Nouveau travailleur" : `Modifier ${worker.name}`}
        </h2>

        <div>
          <label className="label">Nom</label>
          <input
            className="input"
            value={f.name}
            onChange={(e) => up("name", e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Poste</label>
            <select
              className="input"
              value={f.poste}
              onChange={(e) => up("poste", e.target.value)}
            >
              {POSTES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select
              className="input"
              value={f.statut}
              onChange={(e) => up("statut", e.target.value)}
            >
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type de rémunération</label>
            <select
              className="input"
              value={f.pay_type}
              onChange={(e) => up("pay_type", e.target.value)}
            >
              <option value="hourly">Horaire (€/h)</option>
              <option value="monthly">Mensuel (€/mois)</option>
            </select>
          </div>
          <div>
            <label className="label">Le montant saisi est un…</label>
            <select
              className="input"
              value={f.pay_basis}
              onChange={(e) => up("pay_basis", e.target.value)}
            >
              <option value="net">Net (je paye ce net)</option>
              <option value="brut">Brut</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              Montant {f.pay_type === "hourly" ? "(€/h)" : "(€/mois)"}
            </label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={f.base_rate}
              onChange={(e) => up("base_rate", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Code d'accès</label>
            <input
              className="input uppercase"
              value={f.access_code || ""}
              onChange={(e) => up("access_code", e.target.value.toUpperCase())}
              placeholder="auto si vide"
            />
          </div>
        </div>

        {/* Simulateur paie belge */}
        {bd && f.statut !== "independant" && (
          <div className="bg-brand/5 border border-brand/20 rounded-lg p-3 text-sm space-y-1">
            <div className="font-medium text-brand">
              Estimation paie (mensuel indicatif{f.pay_type === "hourly" ? ", 152 h" : ""})
            </div>
            <Row k="Net en poche" v={eur(bd.net)} />
            <Row k="Cotisation travailleur" v={eur(bd.onssWorker)} />
            <Row k="Précompte prof." v={eur(bd.precompte)} />
            <Row k="Brut" v={eur(bd.brut)} strong />
            <Row k="Cotisation patronale" v={eur(bd.employerOnss)} />
            <Row k="Coût total employeur" v={eur(bd.employerCost)} strong />
          </div>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{k}</span>
      <span className={strong ? "font-semibold" : ""}>{v}</span>
    </div>
  );
}
