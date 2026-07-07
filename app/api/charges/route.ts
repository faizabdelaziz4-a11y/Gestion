import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";

export async function GET() {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const charges = await sql`
    SELECT * FROM charges WHERE active = 1 AND business_id = ${biz.id}
    ORDER BY kind, category, label`;
  return json({ charges });
}

export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.label) return bad("Libellé requis");
  const rows = await sql`
    INSERT INTO charges (business_id, label, category, kind, amount, period, date)
    VALUES (${biz.id}, ${b.label}, ${b.category || "autre"}, ${b.kind || "fixe"},
            ${Number(b.amount) || 0}, ${b.period || "mensuel"}, ${b.date || null})
    RETURNING *`;
  return json({ charge: rows[0] }, 201);
}
