/** Helpers communs aux routes API. */
import { NextResponse } from "next/server";
import { getSession, Session } from "./auth";
import { getActiveBusiness } from "./business";
import { Business } from "./db";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Exige une session propriétaire. */
export async function requireOwner(): Promise<Session | NextResponse> {
  const s = await getSession();
  if (!s || s.role !== "owner") return bad("Accès réservé au propriétaire", 401);
  return s;
}

/** Exige une session (propriétaire ou travailleur). */
export async function requireAuth(): Promise<Session | NextResponse> {
  const s = await getSession();
  if (!s) return bad("Non authentifié", 401);
  return s;
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

/** Exige une session propriétaire et renvoie le commerce actif (en-tête). */
export async function requireOwnerBusiness(): Promise<Business | NextResponse> {
  const s = await getSession();
  if (!s || s.role !== "owner") return bad("Accès réservé au propriétaire", 401);
  return getActiveBusiness();
}
