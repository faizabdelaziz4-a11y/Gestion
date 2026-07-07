import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";

const FIELDS = [
  "name",
  "poste",
  "statut",
  "pay_type",
  "pay_basis",
  "base_rate",
  "access_code",
  "active",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const values: Record<string, any> = {};
  for (const f of FIELDS) {
    if (b[f] !== undefined)
      values[f] = f === "base_rate" || f === "active" ? Number(b[f]) : b[f];
  }
  const cols = Object.keys(values);
  if (!cols.length) return bad("Aucun champ à modifier");

  try {
    await sql`
      UPDATE workers SET ${sql(values, ...cols)}
      WHERE id = ${Number(id)} AND business_id = ${biz.id}`;
  } catch (e: any) {
    if (/unique|duplicate/i.test(String(e))) return bad("Code d'accès déjà utilisé");
    return bad("Modification impossible");
  }
  const rows = await sql`SELECT * FROM workers WHERE id = ${Number(id)}`;
  return json({ worker: rows[0] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const { id } = await params;
  await sql`UPDATE workers SET active = 0 WHERE id = ${Number(id)} AND business_id = ${biz.id}`;
  return json({ ok: true });
}
