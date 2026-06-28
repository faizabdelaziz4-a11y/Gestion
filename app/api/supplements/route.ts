import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const worker = req.nextUrl.searchParams.get("worker");
  const rows = worker
    ? db.prepare("SELECT * FROM supplements WHERE worker_id = ? ORDER BY date DESC").all(worker)
    : db.prepare("SELECT * FROM supplements ORDER BY date DESC LIMIT 100").all();
  return json({ supplements: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (!b.worker_id || !b.date) return bad("worker_id et date requis");
  const info = db
    .prepare(
      "INSERT INTO supplements (worker_id, date, label, amount) VALUES (?, ?, ?, ?)"
    )
    .run(Number(b.worker_id), b.date, b.label || null, Number(b.amount) || 0);
  return json({ id: info.lastInsertRowid }, 201);
}

export async function DELETE(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return bad("id requis");
  db.prepare("DELETE FROM supplements WHERE id = ?").run(id);
  return json({ ok: true });
}
