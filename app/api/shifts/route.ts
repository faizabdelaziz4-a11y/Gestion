import { NextRequest } from "next/server";
import { sql, Business } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";
import { shiftHours, rangeFor } from "@/lib/time";
import { shiftKm, dieselCost } from "@/lib/diesel";

async function enrich(s: any, biz: Business) {
  const hours = shiftHours(s.start_time, s.end_time, s.break_minutes);
  const km = shiftKm(s.km_start, s.km_end);
  const diesel =
    km > 0
      ? await dieselCost(km, s.date, {
          consumption: biz.diesel_consumption,
          defaultPrice: biz.default_diesel_price,
        })
      : null;
  return { ...s, hours: Math.round(hours * 100) / 100, km, diesel };
}

export async function GET(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date");
  const period = sp.get("period") as "day" | "week" | "month" | null;
  const worker = sp.get("worker");

  let dateCond = sql``;
  if (date && period) {
    const { start, end } = rangeFor(period, date);
    dateCond = sql`AND s.date BETWEEN ${start} AND ${end}`;
  } else if (date) {
    dateCond = sql`AND s.date = ${date}`;
  }
  const workerCond = worker ? sql`AND s.worker_id = ${Number(worker)}` : sql``;

  const rows = await sql`
    SELECT s.*, w.name AS worker_name, w.poste
    FROM shifts s JOIN workers w ON w.id = s.worker_id
    WHERE w.business_id = ${biz.id} ${dateCond} ${workerCond}
    ORDER BY s.date DESC, s.start_time`;
  const shifts = await Promise.all(rows.map((s) => enrich(s, biz)));
  return json({ shifts });
}

export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.worker_id || !b.date) return bad("worker_id et date requis");

  const owns = await sql`
    SELECT 1 FROM workers WHERE id = ${Number(b.worker_id)} AND business_id = ${biz.id}`;
  if (!owns.length) return bad("Travailleur introuvable dans ce commerce", 404);

  const num = (v: any) => (v != null && v !== "" ? Number(v) : null);
  const rows = await sql`
    INSERT INTO shifts (worker_id, date, start_time, end_time, break_minutes, km_start, km_end, photo_path, source, note)
    VALUES (${Number(b.worker_id)}, ${b.date}, ${b.start_time || null}, ${b.end_time || null},
            ${Number(b.break_minutes) || 0}, ${num(b.km_start)}, ${num(b.km_end)},
            ${b.photo_path || null}, ${b.source || "manuel"}, ${b.note || null})
    RETURNING *`;
  return json({ shift: await enrich(rows[0], biz) }, 201);
}
