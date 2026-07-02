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
      <aside className="md:w-64 md:min-h-screen md:border-r" style={{ background: "#fff", borderColor: "var(--hairline)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: "var(--brand)" }}
            >
              G
            </span>
            <div className="text-base font-bold tracking-tight">Gestion</div>
          </div>
          {/* Sélecteur de commerce (mémorisé par onglet) */}
          <select
            className="input text-sm font-medium"
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
            <option value="__new">＋ Ajouter un commerce…</option>
          </select>
          {active && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <span>🕒 {active.opening_time}–{active.closing_time}</span>
              <span>·</span>
              <span>{active.region}</span>
            </div>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col">
          {NAV.map((n) => {
            const activeNav = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition"
                style={
                  activeNav
                    ? { background: "rgba(13,148,136,0.10)", color: "var(--brand-dark)" }
                    : { color: "#475569" }
                }
              >
                <span className="text-base">{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="mt-1 flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <span className="text-base">🚪</span>
            <span>Déconnexion</span>
          </button>
        </nav>
      </aside>
      {/* La clé force le rechargement des pages au changement de commerce */}
      <main key={active?.id ?? "none"} className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
