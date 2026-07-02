import { NextRequest } from "next/server";
import { db, getBusinessByToken } from "@/lib/db";
import { json, bad } from "@/lib/api";

/**
 * Ingestion publique authentifiée par JETON (pas de session).
 * Permet à une caisse automatique / POS / script de pousser le flux du jour.
 *
 * POST /api/ingest/<token>
 * Body JSON : { date, ca?, margin_pct?, cash_opening?, cash_closing?, cash_expected? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const biz = getBusinessByToken(token);
  if (!biz) return bad("Jeton invalide", 401);

  const b = await req.json().catch(() => ({}));
  const date = String(b.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return bad("Champ 'date' requis (AAAA-MM-JJ)");

  let revenue = false;
  let cash = false;

  if (b.ca != null || b.margin_pct != null || b.platform_ca != null) {
    db.prepare(
      `INSERT INTO revenue (business_id, date, ca, margin_pct, platform_ca, platform_rate, source, note)
       VALUES (@business_id, @date, @ca, @margin_pct, @platform_ca, @platform_rate, 'api', NULL)
       ON CONFLICT(business_id, date) DO UPDATE SET
         ca = excluded.ca, margin_pct = excluded.margin_pct,
         platform_ca = excluded.platform_ca, platform_rate = excluded.platform_rate,
         source = 'api'`
    ).run({
      business_id: biz.id,
      date,
      ca: Number(b.ca) || 0,
      margin_pct: Number(b.margin_pct) || 0,
      platform_ca: Number(b.platform_ca) || 0,
      platform_rate: b.platform_rate != null ? Number(b.platform_rate) : 0.17,
    });
    revenue = true;
  }

  if (b.cash_opening != null || b.cash_closing != null || b.cash_expected != null) {
    db.prepare(
      `INSERT INTO cash (business_id, date, opening, expected_cash, closing, source, note)
       VALUES (@business_id, @date, @opening, @expected_cash, @closing, 'api', NULL)
       ON CONFLICT(business_id, date) DO UPDATE SET
         opening = excluded.opening, expected_cash = excluded.expected_cash,
         closing = excluded.closing, source = 'api'`
    ).run({
      business_id: biz.id,
      date,
      opening: Number(b.cash_opening) || 0,
      expected_cash: Number(b.cash_expected) || 0,
      closing: Number(b.cash_closing) || 0,
    });
    cash = true;
  }

  if (!revenue && !cash)
    return bad("Rien à enregistrer (fournir ca/margin_pct et/ou cash_*)");
  return json({ ok: true, business: biz.name, date, revenue, cash });
}
