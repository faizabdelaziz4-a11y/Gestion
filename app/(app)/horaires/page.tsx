"use client";

import { useEffect, useState } from "react";
import { api, eur, todayISO } from "../../components/api";

interface Worker {
  id: number;
  name: string;
  poste: string;
}
interface Shift {
  id: number;
  worker_id: number;
  worker_name: string;
  poste: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  km_start: number | null;
  km_end: number | null;
  hours: number;
  km: number;
  photo_path: string | null;
  open_photo: string | null;
  close_photo: string | null;
  source: string;
  diesel: { cost: number; liters: number; pricePerLiter: number } | null;
}

type Period = "day" | "week" | "month";

export default function HorairesPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [period, setPeriod] = useState<Period>("week");
  const [date, setDate] = useState(todayISO());

  // formulaire
  const [wid, setWid] = useState("");
  const [form, setForm] = useState({
    date: todayISO(),
    start_time: "",
    end_time: "",
    break_minutes: "0",
    km_start: "",
    km_end: "",
  });

  async function loadWorkers() {
    const r = await api<{ workers: Worker[] }>("/api/workers");
    setWorkers(r.workers);
    if (r.workers[0]) setWid(String(r.workers[0].id));
  }
  async function loadShifts() {
    const r = await api<{ shifts: Shift[] }>(
      `/api/shifts?period=${period}&date=${date}`
    );
    setShifts(r.shifts);
  }
  useEffect(() => {
    loadWorkers();
  }, []);
  useEffect(() => {
    loadShifts();
  }, [period, date]);

  const selectedWorker = workers.find((w) => String(w.id) === wid);
  const isLivreur = selectedWorker?.poste === "livreur";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/shifts", {
      method: "POST",
      body: JSON.stringify({ worker_id: Number(wid), ...form }),
    });
    setForm((f) => ({ ...f, start_time: "", end_time: "", km_start: "", km_end: "" }));
    loadShifts();
  }

  async function uploadKm(file: File, target: "km_start" | "km_end") {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("kind", "km");
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    const data = await res.json();
    if (data.km != null) {
      setForm((f) => ({ ...f, [target]: String(data.km) }));
    } else {
      alert(
        "Lecture automatique indisponible (IA non configurée ou illisible). Saisissez le km à la main."
      );
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Horaires & kilométrage</h1>

      <form onSubmit={add} className="card grid md:grid-cols-3 gap-3">
        <div>
          <label className="label">Travailleur</label>
          <select className="input" value={wid} onChange={(e) => setWid(e.target.value)}>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.poste})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Pause (min)</label>
          <input
            type="number"
            className="input"
            value={form.break_minutes}
            onChange={(e) => setForm({ ...form, break_minutes: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Début</label>
          <input
            type="time"
            className="input"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Fin</label>
          <input
            type="time"
            className="input"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
        </div>
        <div />

        {isLivreur && (
          <>
            <div>
              <label className="label">Km début (livreur)</label>
              <input
                type="number"
                className="input"
                value={form.km_start}
                onChange={(e) => setForm({ ...form, km_start: e.target.value })}
              />
              <PhotoBtn onPick={(f) => uploadKm(f, "km_start")} label="📷 Photo compteur (début)" />
            </div>
            <div>
              <label className="label">Km fin (livreur)</label>
              <input
                type="number"
                className="input"
                value={form.km_end}
                onChange={(e) => setForm({ ...form, km_end: e.target.value })}
              />
              <PhotoBtn onPick={(f) => uploadKm(f, "km_end")} label="📷 Photo compteur (fin)" />
            </div>
            <div className="flex items-end text-sm text-slate-500">
              {form.km_start && form.km_end && (
                <span>
                  Distance :{" "}
                  <strong>
                    {Math.max(0, Number(form.km_end) - Number(form.km_start))} km
                  </strong>
                </span>
              )}
            </div>
          </>
        )}

        <button className="btn-primary md:col-span-3">Ajouter le shift</button>
      </form>

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

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b">
            <tr>
              <th className="cell">Date</th>
              <th className="cell">Travailleur</th>
              <th className="cell">Horaire</th>
              <th className="cell">Heures</th>
              <th className="cell">Km</th>
              <th className="cell">Diesel</th>
              <th className="cell">Photos</th>
              <th className="cell"></th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="cell">{s.date}</td>
                <td className="cell font-medium">
                  {s.worker_name}
                  {s.source === "travailleur" && (
                    <span className="badge bg-blue-50 text-blue-600 ml-1">pointé</span>
                  )}
                </td>
                <td className="cell">
                  {s.start_time || "—"} → {s.end_time || "—"}
                </td>
                <td className="cell">{s.hours} h</td>
                <td className="cell">{s.km ? `${s.km} km` : "—"}</td>
                <td className="cell">
                  {s.diesel ? (
                    <span title={`${s.diesel.liters.toFixed(2)} L @ ${s.diesel.pricePerLiter} €/L`}>
                      {eur(s.diesel.cost)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="cell">
                  <div className="flex items-center gap-1">
                    {[
                      { p: s.open_photo, t: "Ouverture" },
                      { p: s.close_photo, t: "Fermeture" },
                      { p: s.photo_path, t: "Compteur" },
                    ]
                      .filter((x) => x.p)
                      .map((x, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={i} href={x.p!} target="_blank" rel="noreferrer" title={x.t}>
                          <img
                            src={x.p!}
                            alt={x.t}
                            className="h-8 w-8 rounded-md object-cover ring-1 ring-slate-200 hover:ring-brand"
                          />
                        </a>
                      ))}
                    {!s.open_photo && !s.close_photo && !s.photo_path && (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>
                </td>
                <td className="cell">
                  <button
                    className="text-red-500 hover:underline text-xs"
                    onClick={async () => {
                      await api(`/api/shifts/${s.id}`, { method: "DELETE" });
                      loadShifts();
                    }}
                  >
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
            {!shifts.length && (
              <tr>
                <td className="cell text-slate-400" colSpan={8}>
                  Aucun shift sur la période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PhotoBtn({
  onPick,
  label,
}: {
  onPick: (f: File) => void;
  label: string;
}) {
  return (
    <label className="mt-1 inline-block text-xs text-brand cursor-pointer hover:underline">
      {label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
      />
    </label>
  );
}
