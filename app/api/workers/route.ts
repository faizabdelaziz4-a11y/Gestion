import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";
import crypto from "node:crypto";

export async function GET() {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const workers = db
    .prepare("SELECT * FROM workers ORDER BY active DESC, name")
    .all();
  return json({ workers });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("Nom requis");

  const code =
    b.access_code?.trim() ||
    crypto.randomBytes(3).toString("hex").toUpperCase(); // ex. 6 caractères

  try {
    const info = db
      .prepare(
        `INSERT INTO workers (name, poste, statut, pay_type, pay_basis, base_rate, access_code)
         VALUES (@name, @poste, @statut, @pay_type, @pay_basis, @base_rate, @access_code)`
      )
      .run({
        name: b.name,
        poste: b.poste || "vendeur",
        statut: b.statut || "employe",
        pay_type: b.pay_type || "hourly",
        pay_basis: b.pay_basis || "net",
        base_rate: Number(b.base_rate) || 0,
        access_code: code,
      });
    const worker = db
      .prepare("SELECT * FROM workers WHERE id = ?")
      .get(info.lastInsertRowid);
    return json({ worker }, 201);
  } catch (e: any) {
    if (String(e).includes("UNIQUE")) return bad("Code d'accès déjà utilisé");
    return bad("Création impossible");
  }
}
