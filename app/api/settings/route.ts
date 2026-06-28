import { NextRequest } from "next/server";
import { db, setSetting } from "@/lib/db";
import { json, requireOwner, isResponse } from "@/lib/api";
import { aiEnabled } from "@/lib/ocr";

// Clés non sensibles exposées au front.
const PUBLIC_KEYS = [
  "business_name",
  "diesel_consumption",
  "default_diesel_price",
  "employer_onss_rate",
  "onss_worker_rate",
  "onss_student_rate",
  "region",
];

export async function GET() {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const rows = db
    .prepare(
      `SELECT key, value FROM settings WHERE key IN (${PUBLIC_KEYS.map(() => "?").join(",")})`
    )
    .all(...PUBLIC_KEYS) as Array<{ key: string; value: string }>;
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return json({ settings, aiEnabled: aiEnabled() });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  for (const [k, v] of Object.entries(b)) {
    if (PUBLIC_KEYS.includes(k) || k === "owner_password") {
      setSetting(k, String(v));
    }
  }
  return json({ ok: true });
}
