import { db } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";
import { fetchOfficialDieselPrice } from "@/lib/dieselSource";

// Récupère le prix officiel du diesel (Statbel) et l'enregistre (table globale).
export async function POST() {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;

  const result = await fetchOfficialDieselPrice({
    url: biz.diesel_source_url,
    product: biz.diesel_product,
  });
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
