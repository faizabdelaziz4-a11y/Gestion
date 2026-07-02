"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, todayISO } from "../components/api";

interface Shift {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  km_start: number | null;
  km_end: number | null;
  open_photo: string | null;
  close_photo: string | null;
}

export default function EspaceClient({ name }: { name: string }) {
  const router = useRouter();
  const [poste, setPoste] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const today = todayISO();
  const todayShift = shifts.find((s) => s.date === today);
  const isLivreur = poste === "livreur";

  async function load() {
    const r = await api<{ poste: string; shifts: Shift[] }>("/api/worker/clock");
    setPoste(r.poste);
    setShifts(r.shifts);
  }
  useEffect(() => {
    load();
  }, []);

  const now = () => new Date().toTimeString().slice(0, 5);

  async function send(payload: any, message: string) {
    setBusy(true);
    try {
      await api("/api/worker/clock", {
        method: "POST",
        body: JSON.stringify({ date: today, ...payload }),
      });
      await load();
      flash(message);
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  }
  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 1800);
  }

  async function upload(file: File, kind: "photo" | "km") {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("kind", kind);
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    return res.json();
  }

  // Début / fin de journée : photo du local + heure.
  async function clockPhoto(file: File, moment: "open" | "close") {
    setBusy(true);
    setMsg("Envoi de la photo…");
    const data = await upload(file, "photo");
    if (moment === "open")
      await send(
        { start_time: now(), open_photo: data.photo_path },
        "Début de journée enregistré ✓"
      );
    else
      await send(
        { end_time: now(), close_photo: data.photo_path },
        "Fin de journée enregistrée ✓"
      );
  }

  // Kilométrage (livreurs) : photo du compteur.
  async function clockKm(file: File, moment: "start" | "end") {
    setBusy(true);
    setMsg("Lecture du compteur…");
    const data = await upload(file, "km");
    let km = data.km;
    if (km == null) {
      const manual = prompt("Lecture auto impossible. Kilométrage affiché :");
      km = manual ? Number(manual) : null;
    }
    if (km == null) {
      setBusy(false);
      setMsg("");
      return;
    }
    await send(
      moment === "start"
        ? { km_start: km, photo_path: data.photo_path }
        : { km_end: km, photo_path: data.photo_path },
      "Kilométrage enregistré ✓"
    );
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-5 p-4">
      <header className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ background: "var(--brand)" }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="text-xs text-slate-500">Bonjour</div>
            <div className="font-bold leading-tight">{name}</div>
          </div>
        </div>
        <button onClick={logout} className="text-sm text-slate-500">
          Déconnexion
        </button>
      </header>

      {/* Pointage du jour */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Ma journée</div>
          <div className="text-xs text-slate-400">{today}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <BigAction
            label="Début de journée"
            hint="Photo du local"
            time={todayShift?.start_time}
            photo={todayShift?.open_photo}
            done={!!todayShift?.start_time}
            disabled={busy}
            onPick={(f) => clockPhoto(f, "open")}
            tone="brand"
          />
          <BigAction
            label="Fin de journée"
            hint="Photo du local"
            time={todayShift?.end_time}
            photo={todayShift?.close_photo}
            done={!!todayShift?.end_time}
            disabled={busy || !todayShift?.start_time}
            onPick={(f) => clockPhoto(f, "close")}
            tone="slate"
          />
        </div>

        {isLivreur && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="mb-2 text-sm font-medium text-slate-700">
              🚗 Kilométrage — photo du compteur
            </div>
            <div className="grid grid-cols-2 gap-3">
              <KmAction
                label="Km début"
                value={todayShift?.km_start}
                disabled={busy}
                onPick={(f) => clockKm(f, "start")}
              />
              <KmAction
                label="Km fin"
                value={todayShift?.km_end}
                disabled={busy}
                onPick={(f) => clockKm(f, "end")}
              />
            </div>
            {todayShift?.km_start != null && todayShift?.km_end != null && (
              <div className="mt-2 text-center text-sm text-slate-500">
                Distance :{" "}
                <strong>{Math.max(0, todayShift.km_end - todayShift.km_start)} km</strong>
              </div>
            )}
          </div>
        )}

        {msg && (
          <p className="text-center text-sm font-medium" style={{ color: "var(--good-ink)" }}>
            {msg}
          </p>
        )}
      </div>

      {/* Historique */}
      <div className="card">
        <div className="mb-2 font-semibold">Mes derniers jours</div>
        <ul className="divide-y divide-slate-100 text-sm">
          {shifts.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
              <span className="font-medium">{s.date}</span>
              <span className="flex items-center gap-2 text-slate-500">
                <span className="tnum">
                  {s.start_time || "—"} → {s.end_time || "—"}
                </span>
                {s.km_start != null && s.km_end != null && (
                  <span className="badge bg-slate-100 text-slate-600">
                    {Math.max(0, s.km_end - s.km_start)} km
                  </span>
                )}
                {(s.open_photo || s.close_photo) && <span title="Photos jointes">📷</span>}
              </span>
            </li>
          ))}
          {!shifts.length && (
            <li className="py-3 text-slate-400">Aucun pointage pour l'instant.</li>
          )}
        </ul>
      </div>

      <p className="pb-6 text-center text-xs text-slate-400">
        Vous n'avez accès qu'à cette page de pointage.
      </p>
    </div>
  );
}

function BigAction({
  label,
  hint,
  time,
  photo,
  done,
  disabled,
  onPick,
  tone,
}: {
  label: string;
  hint: string;
  time?: string | null;
  photo?: string | null;
  done: boolean;
  disabled: boolean;
  onPick: (f: File) => void;
  tone: "brand" | "slate";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const bg = done
    ? "var(--good)"
    : tone === "brand"
    ? "var(--brand)"
    : "#334155";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => ref.current?.click()}
      className="relative flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-2xl p-3 text-white transition disabled:opacity-50"
      style={{ background: bg }}
    >
      <span className="text-2xl">{done ? "✓" : "📷"}</span>
      <span className="text-sm font-semibold leading-tight">{label}</span>
      <span className="text-[11px] text-white/80">{time ? `à ${time}` : hint}</span>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="absolute right-1.5 top-1.5 h-8 w-8 rounded-md object-cover ring-2 ring-white/70"
        />
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
      />
    </button>
  );
}

function KmAction({
  label,
  value,
  disabled,
  onPick,
}: {
  label: string;
  value?: number | null;
  disabled: boolean;
  onPick: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => ref.current?.click()}
      className="btn-ghost flex-col py-3 disabled:opacity-50"
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs" style={{ color: value != null ? "var(--good-ink)" : "#64748b" }}>
        {value != null ? `${value} km ✓` : "📷 photo"}
      </span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
      />
    </button>
  );
}
