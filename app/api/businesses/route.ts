import { NextRequest } from "next/server";
import { db, listBusinesses } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";
import crypto from "node:crypto";

export async function GET() {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  return json({ businesses: listBusinesses() });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("Nom du commerce requis");
  const info = db
    .prepare("INSERT INTO businesses (name, ingest_token) VALUES (?, ?)")
    .run(b.name, crypto.randomBytes(16).toString("hex"));
  const business = db
    .prepare("SELECT * FROM businesses WHERE id = ?")
    .get(info.lastInsertRowid);
  return json({ business }, 201);
}
