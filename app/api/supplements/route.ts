import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const worker = req.nextUrl.searchParams.get("worker");
  const rows = worker
    ? await sql`
        SELECT s.* FROM supplements s JOIN workers w ON w.id = s.worker_id
        WHERE s.worker_id = ${Number(worker)} AND w.business_id = ${biz.id} ORDER BY s.date DESC`
    : await sql`
        SELECT s.* FROM supplements s JOIN workers w ON w.id = s.worker_id
        WHERE w.business_id = ${biz.id} ORDER BY s.date DESC LIMIT 100`;
  return json({ supplements: rows });
}

export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.worker_id || !b.date) return bad("worker_id et date requis");
  const owns = await sql`
    SELECT 1 FROM workers WHERE id = ${Number(b.worker_id)} AND business_id = ${biz.id}`;
  if (!owns.length) return bad("Travailleur introuvable dans ce commerce", 404);
  const rows = await sql`
    INSERT INTO supplements (worker_id, date, label, amount)
    VALUES (${Number(b.worker_id)}, ${b.date}, ${b.label || null}, ${Number(b.amount) || 0})
    RETURNING id`;
  return json({ id: rows[0].id }, 201);
}

export async function DELETE(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return bad("id requis");
  await sql`
    DELETE FROM supplements WHERE id = ${Number(id)}
      AND worker_id IN (SELECT id FROM workers WHERE business_id = ${biz.id})`;
  return json({ ok: true });
}
