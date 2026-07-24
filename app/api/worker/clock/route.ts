import { NextRequest } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { json, bad } from "@/lib/api";
import { getSession } from "@/lib/auth";

// Espace travailleur : pointage des heures + kilométrage (accès limité).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "worker") return bad("Réservé aux travailleurs", 401);
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  if (!b.date) return bad("Date requise");

  const num = (v: any) => (v != null && v !== "" ? Number(v) : null);
  const data: Record<string, any> = {
    start_time: b.start_time || null,
    end_time: b.end_time || null,
    km_start: num(b.km_start),
    km_end: num(b.km_end),
    photo_path: b.photo_path || null,
    open_photo: b.open_photo || null,
    close_photo: b.close_photo || null,
    note: b.note || null,
  };

  const existing = await sql`
    SELECT id FROM shifts WHERE worker_id = ${s.workerId} AND date = ${b.date}`;

  if (existing.length) {
    // Ne remplace que les champs fournis (pointage progressif).
    const provided: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) if (v !== null) provided[k] = v;
    const cols = Object.keys(provided);
    if (cols.length)
      await sql`UPDATE shifts SET ${sql(provided, ...cols)} WHERE id = ${existing[0].id}`;
    return json({ id: existing[0].id, updated: true });
  }

  const rows = await sql`
    INSERT INTO shifts (worker_id, date, start_time, end_time, break_minutes, km_start, km_end, photo_path, open_photo, close_photo, source, note)
    VALUES (${s.workerId}, ${b.date}, ${data.start_time}, ${data.end_time}, 0, ${data.km_start},
            ${data.km_end}, ${data.photo_path}, ${data.open_photo}, ${data.close_photo}, 'travailleur', ${data.note})
    RETURNING id`;
  return json({ id: rows[0].id, created: true }, 201);
}

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "worker") return bad("Réservé aux travailleurs", 401);
  await ensureSchema();
  const w = await sql`SELECT poste FROM workers WHERE id = ${s.workerId}`;
  const shifts = await sql`
    SELECT * FROM shifts WHERE worker_id = ${s.workerId} ORDER BY date DESC LIMIT 30`;
  return json({ name: s.name, poste: w[0]?.poste || "", shifts });
}
