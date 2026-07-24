import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";
import crypto from "node:crypto";

export async function GET() {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const workers = await sql`
    SELECT * FROM workers WHERE business_id = ${biz.id} ORDER BY active DESC, name`;
  return json({ workers });
}

export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("Nom requis");

  const code =
    b.access_code?.trim() || crypto.randomBytes(3).toString("hex").toUpperCase();

  try {
    const rows = await sql`
      INSERT INTO workers (business_id, name, poste, statut, pay_type, pay_basis, base_rate, access_code)
      VALUES (${biz.id}, ${b.name}, ${b.poste || "vendeur"}, ${b.statut || "employe"},
              ${b.pay_type || "hourly"}, ${b.pay_basis || "net"}, ${Number(b.base_rate) || 0}, ${code})
      RETURNING *`;
    return json({ worker: rows[0] }, 201);
  } catch (e: any) {
    if (/unique|duplicate/i.test(String(e))) return bad("Code d'accès déjà utilisé");
    return bad("Création impossible");
  }
}
