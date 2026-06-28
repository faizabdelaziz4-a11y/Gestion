import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";

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
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const sets: string[] = [];
  const values: any = { id };
  for (const f of FIELDS) {
    if (b[f] !== undefined) {
      sets.push(`${f} = @${f}`);
      values[f] = f === "base_rate" || f === "active" ? Number(b[f]) : b[f];
    }
  }
  if (!sets.length) return bad("Aucun champ à modifier");

  try {
    db.prepare(`UPDATE workers SET ${sets.join(", ")} WHERE id = @id`).run(values);
  } catch (e: any) {
    if (String(e).includes("UNIQUE")) return bad("Code d'accès déjà utilisé");
    return bad("Modification impossible");
  }
  const worker = db.prepare("SELECT * FROM workers WHERE id = ?").get(id);
  return json({ worker });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const { id } = await params;
  // Désactivation par défaut (conserve l'historique). ?hard=1 pour suppression réelle.
  db.prepare("UPDATE workers SET active = 0 WHERE id = ?").run(id);
  return json({ ok: true });
}
