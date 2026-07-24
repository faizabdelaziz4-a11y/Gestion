import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";

const FIELDS = [
  "date",
  "start_time",
  "end_time",
  "break_minutes",
  "km_start",
  "km_end",
  "note",
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
    if (b[f] !== undefined) values[f] = b[f] === "" ? null : b[f];
  }
  const cols = Object.keys(values);
  if (!cols.length) return bad("Aucun champ à modifier");

  await sql`
    UPDATE shifts SET ${sql(values, ...cols)}
    WHERE id = ${Number(id)}
      AND worker_id IN (SELECT id FROM workers WHERE business_id = ${biz.id})`;
  return json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const { id } = await params;
  await sql`
    DELETE FROM shifts WHERE id = ${Number(id)}
      AND worker_id IN (SELECT id FROM workers WHERE business_id = ${biz.id})`;
  return json({ ok: true });
}
