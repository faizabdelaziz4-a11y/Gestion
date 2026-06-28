import { NextRequest } from "next/server";
import { db, listBusinesses } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";
import crypto from "node:crypto";

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

  // Régénération du jeton d'ingestion à la demande.
  if (b.regenerate_token) {
    db.prepare("UPDATE businesses SET ingest_token = ? WHERE id = ?").run(
      crypto.randomBytes(16).toString("hex"),
      id
    );
  }

  const sets: string[] = [];
  const values: any = { id };
  for (const f of FIELDS) {
    if (b[f] !== undefined) {
      sets.push(`${f} = @${f}`);
      values[f] = NUMERIC.has(f) ? Number(b[f]) : b[f];
    }
  }
  if (sets.length) {
    db.prepare(`UPDATE businesses SET ${sets.join(", ")} WHERE id = @id`).run(values);
  }
  const business = db.prepare("SELECT * FROM businesses WHERE id = ?").get(id);
  return json({ business });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const { id } = await params;
  // On garde toujours au moins un commerce.
  if (listBusinesses().length <= 1)
    return bad("Impossible de supprimer le dernier commerce");
  db.prepare("DELETE FROM businesses WHERE id = ?").run(id);
  return json({ ok: true });
}
