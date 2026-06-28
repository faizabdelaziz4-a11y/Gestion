import { db } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";
import { fetchOfficialDieselPrice } from "@/lib/dieselSource";

// Récupère le prix officiel du diesel (Statbel) et l'enregistre.
export async function POST() {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;

  const result = await fetchOfficialDieselPrice();
  if (!result) {
    return bad(
      "Prix officiel indisponible (source injoignable). Saisissez le prix manuellement.",
      502
    );
  }
  db.prepare(
    `INSERT INTO diesel_prices (date, price) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET price = excluded.price`
  ).run(result.date, result.price);
  return json(result);
}
