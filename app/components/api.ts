"use client";

// Commerce actif mémorisé PAR ONGLET (sessionStorage) → chaque onglet peut
// afficher un commerce différent simultanément.
export function getActiveBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("activeBusinessId");
}
export function setActiveBusinessId(id: number | string) {
  if (typeof window !== "undefined")
    window.sessionStorage.setItem("activeBusinessId", String(id));
}

export async function api<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const biz = getActiveBusinessId();
  const res = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(biz ? { "x-business-id": biz } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Erreur ${res.status}`);
  return data as T;
}

export const eur = (n: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(
    n || 0
  );

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const POSTES = ["vendeur", "livreur", "cuisine", "caisse", "gérant", "autre"];
export const STATUTS = [
  { value: "employe", label: "Employé / Ouvrier" },
  { value: "etudiant", label: "Étudiant" },
  { value: "flexi", label: "Flexi-job" },
  { value: "independant", label: "Indépendant / Facturé" },
];
