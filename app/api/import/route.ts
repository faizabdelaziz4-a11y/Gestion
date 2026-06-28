import { NextRequest } from "next/server";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";
import { parseFile, guessMapping } from "@/lib/import";

// Aperçu : reçoit un fichier (CSV/JSON), renvoie colonnes, lignes et mappage proposé.
export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;

  const form = await req.formData().catch(() => null);
  if (!form) return bad("Form-data attendu");
  const file = form.get("file");
  if (!(file instanceof File)) return bad("Fichier manquant");

  const text = await file.text();
  let parsed;
  try {
    parsed = parseFile(file.name, text);
  } catch {
    return bad("Fichier illisible (CSV ou JSON attendu)");
  }
  if (!parsed.columns.length) return bad("Aucune colonne détectée");

  return json({
    columns: parsed.columns,
    rows: parsed.rows.slice(0, 500),
    mapping: guessMapping(parsed.columns),
  });
}
