/** Authentification simple : propriétaire (mot de passe) et travailleur (code d'accès). */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db, getSetting } from "./db";

const COOKIE = "gestion_session";

export type Session =
  | { role: "owner" }
  | { role: "worker"; workerId: number; name: string };

function secret(): string {
  // Secret stable basé sur le mot de passe propriétaire + un sel d'environnement.
  return (process.env.SESSION_SECRET || "") + "::" + getSetting("owner_password", "admin");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return decode(c.get(COOKIE)?.value);
}

export async function setSession(session: Session) {
  const c = await cookies();
  c.set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

/** Tente une connexion propriétaire. */
export function checkOwnerPassword(password: string): boolean {
  return password === getSetting("owner_password", "admin");
}

/** Tente une connexion travailleur via code d'accès. */
export function findWorkerByCode(
  code: string
): { id: number; name: string; poste: string } | null {
  const row = db
    .prepare("SELECT id, name, poste FROM workers WHERE access_code = ? AND active = 1")
    .get(code.trim()) as { id: number; name: string; poste: string } | undefined;
  return row ?? null;
}
