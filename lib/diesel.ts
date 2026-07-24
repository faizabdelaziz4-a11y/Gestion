/** Calcul du coût diesel pour les livreurs. */
import { sql } from "./db";

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
export async function dieselPrice(date: string, fallback: number): Promise<number> {
  const exact = await sql`SELECT price FROM diesel_prices WHERE date = ${date}`;
  if (exact[0]) return exact[0].price as number;
  const recent = await sql`
    SELECT price FROM diesel_prices WHERE date <= ${date} ORDER BY date DESC LIMIT 1`;
  if (recent[0]) return recent[0].price as number;
  return fallback;
}

/**
 * Coût diesel pour une distance, consommation par commerce (def. 6,4 L/100 km),
 * au prix du diesel du jour.
 */
export async function dieselCost(
  km: number,
  date: string,
  cfg: DieselConfig
): Promise<DieselResult> {
  const pricePerLiter = await dieselPrice(date, cfg.defaultPrice);
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
