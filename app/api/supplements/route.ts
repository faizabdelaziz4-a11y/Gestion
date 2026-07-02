import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const worker = req.nextUrl.searchParams.get("worker");
  const rows = worker
    ? db
        .prepare(
          `SELECT s.* FROM supplements s JOIN workers w ON w.id = s.worker_id
           WHERE s.worker_id = ? AND w.business_id = ? ORDER BY s.date DESC`
        )
        .all(worker, biz.id)
    : db
        .prepare(
          `SELECT s.* FROM supplements s JOIN workers w ON w.id = s.worker_id
           WHERE w.business_id = ? ORDER BY s.date DESC LIMIT 100`
        )
        .all(biz.id);
  return json({ supplements: rows });
}

export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.worker_id || !b.date) return bad("worker_id et date requis");
  const owns = db
    .prepare("SELECT 1 FROM workers WHERE id = ? AND business_id = ?")
    .get(Number(b.worker_id), biz.id);
  if (!owns) return bad("Travailleur introuvable dans ce commerce", 404);
  const info = db
    .prepare(
      "INSERT INTO supplements (worker_id, date, label, amount) VALUES (?, ?, ?, ?)"
    )
    .run(Number(b.worker_id), b.date, b.label || null, Number(b.amount) || 0);
  return json({ id: info.lastInsertRowid }, 201);
}

export async function DELETE(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return bad("id requis");
  db.prepare(
    `DELETE FROM supplements WHERE id = ?
     AND worker_id IN (SELECT id FROM workers WHERE business_id = ?)`
  ).run(id, biz.id);
  return json({ ok: true });
}
