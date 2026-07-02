/** Résolution du commerce actif côté serveur (en-tête x-business-id). */
import { headers } from "next/headers";
import { Business, getBusiness, firstBusinessId } from "./db";

/**
 * Id du commerce actif : en-tête `x-business-id` (envoyé par le client,
 * mémorisé par onglet), validé ; sinon le premier commerce.
 */
export async function getActiveBusinessId(): Promise<number> {
  const h = await headers();
  const raw = h.get("x-business-id");
  const id = raw ? parseInt(raw, 10) : NaN;
  if (Number.isInteger(id) && getBusiness(id)) return id;
  return firstBusinessId();
}

/** Commerce actif complet (config + heures). */
export async function getActiveBusiness(): Promise<Business> {
  const id = await getActiveBusinessId();
  return getBusiness(id) ?? getBusiness(firstBusinessId())!;
}
