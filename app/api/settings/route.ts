import { NextRequest } from "next/server";
import { setSetting } from "@/lib/db";
import { json, requireOwner, isResponse } from "@/lib/api";
import { aiEnabled } from "@/lib/ocr";

// Réglages GLOBAUX (indépendants du commerce) : mot de passe propriétaire + statut IA.
// La config par commerce est gérée via /api/businesses.
export async function GET() {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  return json({ aiEnabled: aiEnabled() });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (b.owner_password) setSetting("owner_password", String(b.owner_password));
  return json({ ok: true });
}
