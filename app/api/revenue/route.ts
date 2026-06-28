import { NextRequest } from "next/server";
import { db } from "@/lib/db";
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
    const rows = db
      .prepare(
        "SELECT * FROM revenue WHERE business_id = ? AND date BETWEEN ? AND ? ORDER BY date"
      )
      .all(biz.id, start, end);
    return json({ revenue: rows });
  }
  if (date) {
    const row = db
      .prepare("SELECT * FROM revenue WHERE business_id = ? AND date = ?")
      .get(biz.id, date);
    return json({ revenue: row || null });
  }
  return json({
    revenue: db
      .prepare("SELECT * FROM revenue WHERE business_id = ? ORDER BY date DESC LIMIT 90")
      .all(biz.id),
  });
}

// Upsert du CA + marge pour une date.
export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.date) return bad("Date requise");
  db.prepare(
    `INSERT INTO revenue (business_id, date, ca, margin_pct, source, note)
     VALUES (@business_id, @date, @ca, @margin_pct, 'manuel', @note)
     ON CONFLICT(business_id, date) DO UPDATE SET
       ca = excluded.ca, margin_pct = excluded.margin_pct,
       source = 'manuel', note = excluded.note`
  ).run({
    business_id: biz.id,
    date: b.date,
    ca: Number(b.ca) || 0,
    margin_pct: Number(b.margin_pct) || 0,
    note: b.note || null,
  });
  const row = db
    .prepare("SELECT * FROM revenue WHERE business_id = ? AND date = ?")
    .get(biz.id, b.date);
  return json({ revenue: row });
}
