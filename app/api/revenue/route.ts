import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";
import { rangeFor } from "@/lib/time";

export async function GET(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date");
  const period = (sp.get("period") as "day" | "week" | "month" | null) || null;
  if (date && period) {
    const { start, end } = rangeFor(period, date);
    const rows = await sql`
      SELECT * FROM revenue WHERE business_id = ${biz.id} AND date BETWEEN ${start} AND ${end}
      ORDER BY date`;
    return json({ revenue: rows });
  }
  if (date) {
    const rows = await sql`SELECT * FROM revenue WHERE business_id = ${biz.id} AND date = ${date}`;
    return json({ revenue: rows[0] || null });
  }
  const rows = await sql`
    SELECT * FROM revenue WHERE business_id = ${biz.id} ORDER BY date DESC LIMIT 90`;
  return json({ revenue: rows });
}

// Upsert du CA + marge pour une date.
export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.date) return bad("Date requise");
  const rows = await sql`
    INSERT INTO revenue (business_id, date, ca, margin_pct, platform_ca, platform_rate, source, note)
    VALUES (${biz.id}, ${b.date}, ${Number(b.ca) || 0}, ${Number(b.margin_pct) || 0},
            ${Number(b.platform_ca) || 0}, ${b.platform_rate != null ? Number(b.platform_rate) : 0.17},
            'manuel', ${b.note || null})
    ON CONFLICT (business_id, date) DO UPDATE SET
      ca = excluded.ca, margin_pct = excluded.margin_pct,
      platform_ca = excluded.platform_ca, platform_rate = excluded.platform_rate,
      source = 'manuel', note = excluded.note
    RETURNING *`;
  return json({ revenue: rows[0] });
}
