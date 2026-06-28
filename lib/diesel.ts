/** Calcul du coût diesel pour les livreurs. */
import { db, getNumberSetting } from "./db";

export interface DieselResult {
  km: number;
  liters: number;
  pricePerLiter: number;
  cost: number;
}

/** Prix du diesel à une date : prix saisi du jour, sinon le plus récent connu, sinon défaut. */
export function dieselPrice(date: string): number {
  const exact = db
    .prepare("SELECT price FROM diesel_prices WHERE date = ?")
    .get(date) as { price: number } | undefined;
  if (exact) return exact.price;
  const recent = db
    .prepare("SELECT price FROM diesel_prices WHERE date <= ? ORDER BY date DESC LIMIT 1")
    .get(date) as { price: number } | undefined;
  if (recent) return recent.price;
  return getNumberSetting("default_diesel_price", 1.75);
}

/**
 * Coût diesel pour une distance, consommation paramétrable (def. 6,4 L/100 km),
 * au prix du diesel du jour à Liège.
 */
export function dieselCost(km: number, date: string): DieselResult {
  const consumption = getNumberSetting("diesel_consumption", 6.4); // L/100km
  const pricePerLiter = dieselPrice(date);
  const liters = (Math.max(0, km) * consumption) / 100;
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
