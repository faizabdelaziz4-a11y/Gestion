import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";

export async function GET() {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const prices = await sql`SELECT * FROM diesel_prices ORDER BY date DESC LIMIT 60`;
  return json({ prices });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (!b.date || b.price == null) return bad("date et price requis");
  await sql`
    INSERT INTO diesel_prices (date, price) VALUES (${b.date}, ${Number(b.price)})
    ON CONFLICT (date) DO UPDATE SET price = excluded.price`;
  return json({ ok: true });
}
