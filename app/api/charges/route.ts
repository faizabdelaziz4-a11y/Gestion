import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";

export async function GET() {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const charges = db
    .prepare("SELECT * FROM charges WHERE active = 1 ORDER BY kind, category, label")
    .all();
  return json({ charges });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (!b.label) return bad("Libellé requis");
  const info = db
    .prepare(
      `INSERT INTO charges (label, category, kind, amount, period, date)
       VALUES (@label, @category, @kind, @amount, @period, @date)`
    )
    .run({
      label: b.label,
      category: b.category || "autre",
      kind: b.kind || "fixe",
      amount: Number(b.amount) || 0,
      period: b.period || "mensuel",
      date: b.date || null,
    });
  const charge = db.prepare("SELECT * FROM charges WHERE id = ?").get(info.lastInsertRowid);
  return json({ charge }, 201);
}
