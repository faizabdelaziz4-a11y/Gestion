import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";
import { rangeFor } from "@/lib/time";

export async function GET(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date");
  const period = (sp.get("period") as "day" | "week" | "month" | null) || null;
  if (date && period) {
    const { start, end } = rangeFor(period, date);
    const rows = db
      .prepare("SELECT * FROM revenue WHERE date BETWEEN ? AND ? ORDER BY date")
      .all(start, end);
    return json({ revenue: rows });
  }
  if (date) {
    const row = db.prepare("SELECT * FROM revenue WHERE date = ?").get(date);
    return json({ revenue: row || null });
  }
  return json({ revenue: db.prepare("SELECT * FROM revenue ORDER BY date DESC LIMIT 90").all() });
}

// Upsert du CA + marge pour une date.
export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (!b.date) return bad("Date requise");
  db.prepare(
    `INSERT INTO revenue (date, ca, margin_pct, note) VALUES (@date, @ca, @margin_pct, @note)
     ON CONFLICT(date) DO UPDATE SET ca = excluded.ca, margin_pct = excluded.margin_pct, note = excluded.note`
  ).run({
    date: b.date,
    ca: Number(b.ca) || 0,
    margin_pct: Number(b.margin_pct) || 0,
    note: b.note || null,
  });
  const row = db.prepare("SELECT * FROM revenue WHERE date = ?").get(b.date);
  return json({ revenue: row });
}
