import { NextRequest } from "next/server";
import { json, bad, requireAuth, isResponse } from "@/lib/api";
import { saveImage } from "@/lib/upload";
import { readDashboardKm, readSchedule } from "@/lib/ocr";

// Accepte une image (multipart) + kind=km|schedule. Renvoie la lecture IA
// et le chemin du fichier sauvegardé (pour l'attacher au shift).
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (isResponse(guard)) return guard;

  const form = await req.formData().catch(() => null);
  if (!form) return bad("Form-data attendu");
  const file = form.get("image");
  const kind = String(form.get("kind") || "km");
  if (!(file instanceof File)) return bad("Image manquante");

  const saved = await saveImage(file);
  const image = { base64: saved.base64, mediaType: saved.mediaType };

  if (kind === "schedule") {
    const entries = await readSchedule(image);
    return json({ photo_path: saved.relPath, entries });
  }
  const km = await readDashboardKm(image);
  return json({ photo_path: saved.relPath, ...km });
}
