"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, todayISO } from "../components/api";

interface Shift {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  km_start: number | null;
  km_end: number | null;
}

export default function EspaceClient({ name }: { name: string }) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const today = todayISO();
  const todayShift = shifts.find((s) => s.date === today);

  async function load() {
    const r = await api<{ shifts: Shift[] }>("/api/worker/clock");
    setShifts(r.shifts);
  }
  useEffect(() => {
    load();
  }, []);

  function now() {
    return new Date().toTimeString().slice(0, 5);
  }

  async function send(payload: any) {
    setBusy(true);
    try {
      await api("/api/worker/clock", {
        method: "POST",
        body: JSON.stringify({ date: today, ...payload }),
      });
      await load();
      setMsg("Enregistré ✓");
      setTimeout(() => setMsg(""), 1500);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function photoKm(file: File, target: "km_start" | "km_end") {
    setBusy(true);
    setMsg("Lecture de la photo…");
    const fd = new FormData();
    fd.append("image", file);
    fd.append("kind", "km");
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (data.km != null) {
      await send({ [target]: data.km, photo_path: data.photo_path });
    } else {
      const manual = prompt(
        "Lecture automatique impossible. Entrez le kilométrage affiché :"
      );
      if (manual) await send({ [target]: Number(manual), photo_path: data.photo_path });
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto space-y-5">
      <div className="flex items-center justify-between pt-4">
        <div>
          <div className="text-xs text-slate-500">Bonjour</div>
          <div className="text-xl font-bold">{name}</div>
        </div>
        <button onClick={logout} className="text-sm text-slate-500">
          Déconnexion
        </button>
      </div>

      <div className="card space-y-3">
        <div className="text-sm text-slate-500">Aujourd'hui — {today}</div>

        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={busy || !!todayShift?.start_time}
            className="btn-primary py-4 text-base disabled:opacity-50"
            onClick={() => send({ start_time: now() })}
          >
            ▶︎ Début
            <br />
            <span className="text-xs">{todayShift?.start_time || ""}</span>
          </button>
          <button
            disabled={busy || !todayShift?.start_time}
            className="btn-ghost py-4 text-base disabled:opacity-50"
            onClick={() => send({ end_time: now() })}
          >
            ⏹ Fin
            <br />
            <span className="text-xs">{todayShift?.end_time || ""}</span>
          </button>
        </div>

        {msg && <p className="text-sm text-emerald-600 text-center">{msg}</p>}
      </div>

      <div className="card space-y-3">
        <div className="font-medium">Kilométrage (livreur)</div>
        <p className="text-xs text-slate-500">
          Prenez en photo le compteur de la voiture. La valeur est lue
          automatiquement (ou à saisir si l'IA n'est pas disponible).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <PhotoButton
            label="📷 Km début"
            value={todayShift?.km_start}
            onPick={(f) => photoKm(f, "km_start")}
          />
          <PhotoButton
            label="📷 Km fin"
            value={todayShift?.km_end}
            onPick={(f) => photoKm(f, "km_end")}
          />
        </div>
      </div>

      <div className="card">
        <div className="font-medium mb-2">Mes derniers jours</div>
        <ul className="text-sm divide-y divide-slate-100">
          {shifts.map((s) => (
            <li key={s.id} className="py-2 flex justify-between">
              <span>{s.date}</span>
              <span className="text-slate-500">
                {s.start_time || "—"}→{s.end_time || "—"}
                {s.km_start != null && s.km_end != null
                  ? ` · ${Math.max(0, s.km_end - s.km_start)} km`
                  : ""}
              </span>
            </li>
          ))}
          {!shifts.length && <li className="py-2 text-slate-400">Aucun pointage.</li>}
        </ul>
      </div>
    </div>
  );
}

function PhotoButton({
  label,
  value,
  onPick,
}: {
  label: string;
  value: number | null | undefined;
  onPick: (f: File) => void;
}) {
  return (
    <label className="btn-ghost py-4 text-center cursor-pointer flex-col">
      <span>{label}</span>
      {value != null && <span className="text-xs text-emerald-600">{value} km ✓</span>}
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
