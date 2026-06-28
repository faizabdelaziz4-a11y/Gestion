/**
 * Récupération automatique du prix officiel du diesel en Belgique.
 *
 * Source : Statbel (be.STAT) — « Tarif officiel des produits pétroliers ».
 * Le SPF Économie calcule chaque jour ouvrable le prix maximum officiel.
 * On prend le « Diesel B7 » TVA incluse (prix payé à la pompe).
 *
 * URL et produit paramétrables via les réglages (diesel_source_url,
 * diesel_product). 100 % optionnel : en cas d'échec réseau, on garde la
 * saisie manuelle / le prix par défaut.
 */
import { getSetting } from "./db";

const DEFAULT_URL =
  "https://bestat.statbel.fgov.be/bestat/api/views/9e9cf394-6c54-4d81-8013-7124a8c4bf15/result/JSON";
const DEFAULT_PRODUCT = "Diesel B7 (€/L)";

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** Convertit "29JUN26" -> "2026-06-29". */
export function parseBestatDay(day: string): string | null {
  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(day.trim().toUpperCase());
  if (!m) return null;
  const mm = MONTHS[m[2]];
  if (!mm) return null;
  return `20${m[3]}-${mm}-${m[1]}`;
}

export interface OfficialPrice {
  date: string;
  price: number;
  product: string;
  source: string;
}

interface Fact {
  Produit: string;
  Jour: string;
  "Prix TVA incl.": number | null;
}

/** Récupère le prix officiel du diesel le plus récent. */
export async function fetchOfficialDieselPrice(): Promise<OfficialPrice | null> {
  const url = getSetting("diesel_source_url", DEFAULT_URL) || DEFAULT_URL;
  const product = getSetting("diesel_product", DEFAULT_PRODUCT) || DEFAULT_PRODUCT;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { facts?: Fact[] };
    const facts = data.facts || [];

    // Ligne du produit choisi, dernière date disponible.
    const rows = facts
      .filter((f) => f.Produit === product && f["Prix TVA incl."] != null)
      .map((f) => ({ ...f, iso: parseBestatDay(f.Jour) }))
      .filter((f) => f.iso) as Array<Fact & { iso: string }>;
    if (!rows.length) return null;
    rows.sort((a, b) => (a.iso < b.iso ? 1 : -1));
    const top = rows[0];

    return {
      date: top.iso,
      price: Math.round((top["Prix TVA incl."] as number) * 1000) / 1000,
      product,
      source: "Statbel / SPF Économie",
    };
  } catch {
    return null;
  }
}
