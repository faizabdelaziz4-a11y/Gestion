"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "./api";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: "📊" },
  { href: "/revenus", label: "CA & marge", icon: "💶" },
  { href: "/caisse", label: "Caisse", icon: "💰" },
  { href: "/travailleurs", label: "Travailleurs", icon: "👥" },
  { href: "/horaires", label: "Horaires & km", icon: "🕒" },
  { href: "/charges", label: "Charges", icon: "🧾" },
  { href: "/reglages", label: "Réglages", icon: "⚙️" },
];

export default function Shell({
  business,
  children,
}: {
  business: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-64 bg-white border-r border-slate-200 md:min-h-screen">
        <div className="p-5 border-b border-slate-100">
          <div className="text-lg font-bold text-brand">Gestion</div>
          <div className="text-xs text-slate-500 truncate">{business}</div>
        </div>
        <nav className="p-3 flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
                  active
                    ? "bg-brand text-white"
                    : "text-slate-600 hover:bg-slate-100"
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
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
