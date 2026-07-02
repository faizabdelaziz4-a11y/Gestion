"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../components/api";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"owner" | "worker">("owner");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "owner") {
        await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
        router.push("/");
      } else {
        await api("/api/auth/login", { method: "POST", body: JSON.stringify({ code }) });
        router.push("/espace");
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      {/* Panneau marque */}
      <div
        className="hidden flex-col justify-between p-10 text-white md:flex"
        style={{ background: "linear-gradient(150deg,#0f766e,#0d9488 55%,#14b8a6)" }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 font-bold">
            G
          </span>
          <span className="text-lg font-bold">Gestion</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Vos dépenses, votre paie
            <br />
            et votre bénéfice net.
          </h1>
          <p className="mt-4 max-w-sm text-white/80">
            Le pilotage financier des commerçants — vue jour, semaine et mois,
            paie belge automatisée, contrôle de caisse et bénéfice en temps réel.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/90">
            {[
              "Bénéfice / perte en un coup d'œil",
              "Paie net → brut → coût employeur (Belgique)",
              "Diesel officiel, caisse, plateformes de livraison",
              "Multi-commerce & import de votre caisse",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span>✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/60">Estimations paramétrables · Belgique</p>
      </div>

      {/* Formulaire */}
      <div className="flex min-h-screen items-center justify-center p-6 md:min-h-full">
        <div className="w-full max-w-sm">
          <div className="mb-6 md:hidden">
            <div className="text-2xl font-bold text-brand">Gestion</div>
          </div>
          <h2 className="text-xl font-bold">Connexion</h2>
          <p className="mb-6 text-sm text-slate-500">Accédez à votre espace.</p>

          <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === "owner" ? "bg-white shadow-sm" : "text-slate-500"
              }`}
              onClick={() => setTab("owner")}
            >
              Propriétaire
            </button>
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === "worker" ? "bg-white shadow-sm" : "text-slate-500"
              }`}
              onClick={() => setTab("worker")}
            >
              Travailleur
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tab === "owner" ? (
              <div>
                <label className="label">Mot de passe</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin (par défaut)"
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <label className="label">Code d'accès</label>
                <input
                  className="input uppercase tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Votre code"
                  autoFocus
                />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
