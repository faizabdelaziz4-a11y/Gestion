import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";

const FIELDS = ["label", "category", "kind", "amount", "period", "date", "active"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const values: any = { id, business_id: biz.id };
  for (const f of FIELDS) {
    if (b[f] !== undefined) {
      sets.push(`${f} = @${f}`);
      values[f] = f === "amount" || f === "active" ? Number(b[f]) : b[f];
    }
  }
  if (!sets.length) return bad("Aucun champ à modifier");
  db.prepare(
    `UPDATE charges SET ${sets.join(", ")} WHERE id = @id AND business_id = @business_id`
  ).run(values);
  return json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const { id } = await params;
  db.prepare("UPDATE charges SET active = 0 WHERE id = ? AND business_id = ?").run(
    id,
    biz.id
  );
  return json({ ok: true });
}
