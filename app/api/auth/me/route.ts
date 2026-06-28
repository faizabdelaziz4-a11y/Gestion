import { json } from "@/lib/api";
import { getSession } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  return json({ session: s });
}
