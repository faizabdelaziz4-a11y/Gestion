import { NextRequest } from "next/server";
import { sql, listBusinesses, randomToken } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";

const FIELDS = [
  "name",
  "opening_time",
  "closing_time",
  "region",
  "diesel_consumption",
  "default_diesel_price",
  "employer_onss_rate",
  "onss_worker_rate",
  "onss_student_rate",
  "diesel_product",
  "diesel_source_url",
] as const;
const NUMERIC = new Set([
  "diesel_consumption",
  "default_diesel_price",
  "employer_onss_rate",
  "onss_worker_rate",
  "onss_student_rate",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  if (b.regenerate_token) {
    await sql`UPDATE businesses SET ingest_token = ${randomToken()} WHERE id = ${Number(id)}`;
  }

  const values: Record<string, any> = {};
  for (const f of FIELDS) {
    if (b[f] !== undefined) values[f] = NUMERIC.has(f) ? Number(b[f]) : b[f];
  }
  const cols = Object.keys(values);
  if (cols.length) {
    await sql`UPDATE businesses SET ${sql(values, ...cols)} WHERE id = ${Number(id)}`;
  }
  const rows = await sql`SELECT * FROM businesses WHERE id = ${Number(id)}`;
  return json({ business: rows[0] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const { id } = await params;
  if ((await listBusinesses()).length <= 1)
    return bad("Impossible de supprimer le dernier commerce");
  await sql`DELETE FROM businesses WHERE id = ${Number(id)}`;
  return json({ ok: true });
}
