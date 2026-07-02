import { NextRequest } from "next/server";
import { json, bad } from "@/lib/api";
import { checkOwnerPassword, findWorkerByCode, setSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { password, code } = body as { password?: string; code?: string };

  if (password != null) {
    if (!checkOwnerPassword(password)) return bad("Mot de passe incorrect", 401);
    await setSession({ role: "owner" });
    return json({ role: "owner" });
  }

  if (code != null) {
    const w = findWorkerByCode(code);
    if (!w) return bad("Code d'accès invalide", 401);
    await setSession({ role: "worker", workerId: w.id, name: w.name });
    return json({ role: "worker", workerId: w.id, name: w.name, poste: w.poste });
  }

  return bad("Identifiants manquants");
}
