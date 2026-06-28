"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { BusinessProvider, useBusiness } from "./BusinessContext";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: "📊" },
  { href: "/revenus", label: "CA & marge", icon: "💶" },
  { href: "/caisse", label: "Caisse", icon: "💰" },
  { href: "/travailleurs", label: "Travailleurs", icon: "👥" },
  { href: "/horaires", label: "Horaires & km", icon: "🕒" },
  { href: "/charges", label: "Charges", icon: "🧾" },
  { href: "/imports", label: "Imports", icon: "📥" },
  { href: "/reglages", label: "Réglages", icon: "⚙️" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <BusinessProvider>
      <ShellInner>{children}</ShellInner>
    </BusinessProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { businesses, active, setActive, refresh } = useBusiness();
  const [creating, setCreating] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function addBusiness() {
    const name = prompt("Nom du nouveau commerce :");
    if (!name) return;
    setCreating(true);
    try {
      const r = await api<{ business: { id: number } }>("/api/businesses", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await refresh();
      setActive(r.business.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-64 bg-white border-r border-slate-200 md:min-h-screen">
        <div className="p-4 border-b border-slate-100">
          <div className="text-lg font-bold text-brand mb-2">Gestion</div>
          {/* Sélecteur de commerce (mémorisé par onglet) */}
          <select
            className="input text-sm"
            value={active?.id ?? ""}
            onChange={(e) => {
              if (e.target.value === "__new") addBusiness();
              else setActive(Number(e.target.value));
            }}
            disabled={creating}
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value="__new">➕ Ajouter un commerce…</option>
          </select>
          {active && (
            <div className="text-xs text-slate-400 mt-1">
              🕒 {active.opening_time}–{active.closing_time} · {active.region}
            </div>
          )}
        </div>
        <nav className="p-3 flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map((n) => {
            const activeNav = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
                  activeNav ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 whitespace-nowrap"
          >
            <span>🚪</span>
            <span>Déconnexion</span>
          </button>
        </nav>
      </aside>
      {/* La clé force le rechargement des pages au changement de commerce */}
      <main key={active?.id ?? "none"} className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
