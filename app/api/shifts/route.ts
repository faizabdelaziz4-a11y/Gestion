import { NextRequest } from "next/server";
import { db, Business } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";
import { shiftHours, rangeFor } from "@/lib/time";
import { shiftKm, dieselCost } from "@/lib/diesel";

function enrich(s: any, biz: Business) {
  const hours = shiftHours(s.start_time, s.end_time, s.break_minutes);
  const km = shiftKm(s.km_start, s.km_end);
  const diesel =
    km > 0
      ? dieselCost(km, s.date, {
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

  let sql =
    "SELECT s.*, w.name AS worker_name, w.poste FROM shifts s JOIN workers w ON w.id = s.worker_id WHERE w.business_id = ?";
  const args: any[] = [biz.id];
  if (date && period) {
    const { start, end } = rangeFor(period, date);
    sql += " AND s.date BETWEEN ? AND ?";
    args.push(start, end);
  } else if (date) {
    sql += " AND s.date = ?";
    args.push(date);
  }
  if (worker) {
    sql += " AND s.worker_id = ?";
    args.push(worker);
  }
  sql += " ORDER BY s.date DESC, s.start_time";
  const shifts = (db.prepare(sql).all(...args) as any[]).map((s) => enrich(s, biz));
  return json({ shifts });
}

export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.worker_id || !b.date) return bad("worker_id et date requis");

  // Le travailleur doit appartenir au commerce actif.
  const owns = db
    .prepare("SELECT 1 FROM workers WHERE id = ? AND business_id = ?")
    .get(Number(b.worker_id), biz.id);
  if (!owns) return bad("Travailleur introuvable dans ce commerce", 404);

  const info = db
    .prepare(
      `INSERT INTO shifts (worker_id, date, start_time, end_time, break_minutes, km_start, km_end, photo_path, source, note)
       VALUES (@worker_id, @date, @start_time, @end_time, @break_minutes, @km_start, @km_end, @photo_path, @source, @note)`
    )
    .run({
      worker_id: Number(b.worker_id),
      date: b.date,
      start_time: b.start_time || null,
      end_time: b.end_time || null,
      break_minutes: Number(b.break_minutes) || 0,
      km_start: b.km_start != null && b.km_start !== "" ? Number(b.km_start) : null,
      km_end: b.km_end != null && b.km_end !== "" ? Number(b.km_end) : null,
      photo_path: b.photo_path || null,
      source: b.source || "manuel",
      note: b.note || null,
    });
  const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(info.lastInsertRowid);
  return json({ shift: enrich(shift, biz) }, 201);
}
