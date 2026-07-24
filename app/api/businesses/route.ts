import { NextRequest } from "next/server";
import { sql, listBusinesses, randomToken } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";

export async function GET() {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  return json({ businesses: await listBusinesses() });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("Nom du commerce requis");
  const rows = await sql`
    INSERT INTO businesses (name, ingest_token) VALUES (${b.name}, ${randomToken()})
    RETURNING *`;
  return json({ business: rows[0] }, 201);
}
