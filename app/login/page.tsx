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
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        router.push("/");
      } else {
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-brand">Gestion</div>
          <p className="text-sm text-slate-500">
            Dépenses, paie & bénéfice net — commerçants
          </p>
        </div>

        <div className="flex gap-2 mb-5 bg-slate-100 rounded-lg p-1">
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              tab === "owner" ? "bg-white shadow-sm" : "text-slate-500"
            }`}
            onClick={() => setTab("owner")}
          >
            Propriétaire
          </button>
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
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
  );
}
