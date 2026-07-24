import { NextRequest } from "next/server";
import { sql, getBusinessByToken, ensureSchema } from "@/lib/db";
import { json, bad } from "@/lib/api";

/**
 * Ingestion publique authentifiée par JETON (pas de session).
 * POST /api/ingest/<token>
 * Body JSON : { date, ca?, margin_pct?, platform_ca?, cash_opening?, cash_closing?, cash_expected? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  await ensureSchema();
  const { token } = await params;
  const biz = await getBusinessByToken(token);
  if (!biz) return bad("Jeton invalide", 401);

  const b = await req.json().catch(() => ({}));
  const date = String(b.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("Champ 'date' requis (AAAA-MM-JJ)");

  let revenue = false;
  let cash = false;

  if (b.ca != null || b.margin_pct != null || b.platform_ca != null) {
    await sql`
      INSERT INTO revenue (business_id, date, ca, margin_pct, platform_ca, platform_rate, source, note)
      VALUES (${biz.id}, ${date}, ${Number(b.ca) || 0}, ${Number(b.margin_pct) || 0},
              ${Number(b.platform_ca) || 0}, ${b.platform_rate != null ? Number(b.platform_rate) : 0.17}, 'api', NULL)
      ON CONFLICT (business_id, date) DO UPDATE SET
        ca = excluded.ca, margin_pct = excluded.margin_pct,
        platform_ca = excluded.platform_ca, platform_rate = excluded.platform_rate, source = 'api'`;
    revenue = true;
  }

  if (b.cash_opening != null || b.cash_closing != null || b.cash_expected != null) {
    await sql`
      INSERT INTO cash (business_id, date, opening, expected_cash, closing, source, note)
      VALUES (${biz.id}, ${date}, ${Number(b.cash_opening) || 0}, ${Number(b.cash_expected) || 0},
              ${Number(b.cash_closing) || 0}, 'api', NULL)
      ON CONFLICT (business_id, date) DO UPDATE SET
        opening = excluded.opening, expected_cash = excluded.expected_cash,
        closing = excluded.closing, source = 'api'`;
    cash = true;
  }

  if (!revenue && !cash)
    return bad("Rien à enregistrer (fournir ca/margin_pct et/ou cash_*)");
  return json({ ok: true, business: biz.name, date, revenue, cash });
}
