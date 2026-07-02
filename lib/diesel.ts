/** Calcul du coût diesel pour les livreurs. */
import { db } from "./db";

export interface DieselResult {
  km: number;
  liters: number;
  pricePerLiter: number;
  cost: number;
}

export interface DieselConfig {
  consumption: number; // L / 100 km
  defaultPrice: number; // €/L de repli
}

/** Prix du diesel (table globale, prix officiel national) à une date. */
export function dieselPrice(date: string, fallback: number): number {
  const exact = db
    .prepare("SELECT price FROM diesel_prices WHERE date = ?")
    .get(date) as { price: number } | undefined;
  if (exact) return exact.price;
  const recent = db
    .prepare("SELECT price FROM diesel_prices WHERE date <= ? ORDER BY date DESC LIMIT 1")
    .get(date) as { price: number } | undefined;
  if (recent) return recent.price;
  return fallback;
}

/**
 * Coût diesel pour une distance, consommation par commerce (def. 6,4 L/100 km),
 * au prix du diesel du jour.
 */
export function dieselCost(km: number, date: string, cfg: DieselConfig): DieselResult {
  const pricePerLiter = dieselPrice(date, cfg.defaultPrice);
  const liters = (Math.max(0, km) * cfg.consumption) / 100;
  return {
    km: Math.max(0, km),
    liters,
    pricePerLiter,
    cost: liters * pricePerLiter,
  };
}

/** Km d'un shift livreur (fin - début). */
export function shiftKm(kmStart?: number | null, kmEnd?: number | null): number {
  if (kmStart == null || kmEnd == null) return 0;
  return Math.max(0, kmEnd - kmStart);
}
