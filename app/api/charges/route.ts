import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";

export async function GET() {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const charges = db
    .prepare(
      "SELECT * FROM charges WHERE active = 1 AND business_id = ? ORDER BY kind, category, label"
    )
    .all(biz.id);
  return json({ charges });
}

export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.label) return bad("Libellé requis");
  const info = db
    .prepare(
      `INSERT INTO charges (business_id, label, category, kind, amount, period, date)
       VALUES (@business_id, @label, @category, @kind, @amount, @period, @date)`
    )
    .run({
      business_id: biz.id,
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
