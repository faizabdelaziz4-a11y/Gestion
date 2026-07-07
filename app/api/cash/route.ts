import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";
import { rangeFor } from "@/lib/time";

interface CashRow {
  date: string;
  opening: number;
  expected_cash: number;
  closing: number;
  note: string | null;
}

const round = (n: number) => Math.round(n * 100) / 100;
function withEcart(r: CashRow) {
  const recette = r.closing - r.opening;
  return { ...r, recette: round(recette), ecart: round(recette - r.expected_cash) };
}

export async function GET(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date");
  const period = sp.get("period") as "day" | "week" | "month" | null;

  if (date && !period) {
    const rows = await sql`SELECT * FROM cash WHERE business_id = ${biz.id} AND date = ${date}`;
    return json({ cash: rows[0] ? withEcart(rows[0] as unknown as CashRow) : null });
  }
  if (date && period) {
    const { start, end } = rangeFor(period, date);
    const rows = (await sql`
      SELECT * FROM cash WHERE business_id = ${biz.id} AND date BETWEEN ${start} AND ${end}
      ORDER BY date DESC`) as unknown as CashRow[];
    return json({ cash: rows.map(withEcart) });
  }
  const rows = (await sql`
    SELECT * FROM cash WHERE business_id = ${biz.id} ORDER BY date DESC LIMIT 60`) as unknown as CashRow[];
  return json({ cash: rows.map(withEcart) });
}

export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.date) return bad("Date requise");
  const rows = await sql`
    INSERT INTO cash (business_id, date, opening, expected_cash, closing, source, note)
    VALUES (${biz.id}, ${b.date}, ${Number(b.opening) || 0}, ${Number(b.expected_cash) || 0},
            ${Number(b.closing) || 0}, 'manuel', ${b.note || null})
    ON CONFLICT (business_id, date) DO UPDATE SET
      opening = excluded.opening, expected_cash = excluded.expected_cash,
      closing = excluded.closing, source = 'manuel', note = excluded.note
    RETURNING *`;
  return json({ cash: withEcart(rows[0] as unknown as CashRow) });
}
