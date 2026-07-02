import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad } from "@/lib/api";
import { getSession } from "@/lib/auth";

// Espace travailleur : pointage des heures + kilométrage (accès limité).
// Le travailleur ne peut enregistrer que ses propres shifts.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "worker") return bad("Réservé aux travailleurs", 401);
  const b = await req.json().catch(() => ({}));
  if (!b.date) return bad("Date requise");

  // Un shift par jour et par travailleur : on met à jour s'il existe.
  const existing = db
    .prepare("SELECT id FROM shifts WHERE worker_id = ? AND date = ?")
    .get(s.workerId, b.date) as { id: number } | undefined;

  const data = {
    start_time: b.start_time || null,
    end_time: b.end_time || null,
    km_start: b.km_start != null && b.km_start !== "" ? Number(b.km_start) : null,
    km_end: b.km_end != null && b.km_end !== "" ? Number(b.km_end) : null,
    photo_path: b.photo_path || null,
    open_photo: b.open_photo || null,
    close_photo: b.close_photo || null,
    note: b.note || null,
  };

  if (existing) {
    // Ne remplace que les champs fournis (pointage progressif arrivée/départ).
    const sets: string[] = [];
    const vals: any = { id: existing.id };
    for (const [k, v] of Object.entries(data)) {
      if (v !== null) {
        sets.push(`${k} = @${k}`);
        vals[k] = v;
      }
    }
    if (sets.length)
      db.prepare(`UPDATE shifts SET ${sets.join(", ")} WHERE id = @id`).run(vals);
    return json({ id: existing.id, updated: true });
  }

  const info = db
    .prepare(
      `INSERT INTO shifts (worker_id, date, start_time, end_time, break_minutes, km_start, km_end, photo_path, open_photo, close_photo, source, note)
       VALUES (@worker_id, @date, @start_time, @end_time, 0, @km_start, @km_end, @photo_path, @open_photo, @close_photo, 'travailleur', @note)`
    )
    .run({ worker_id: s.workerId, date: b.date, ...data });
  return json({ id: info.lastInsertRowid, created: true }, 201);
}

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "worker") return bad("Réservé aux travailleurs", 401);
  const w = db
    .prepare("SELECT poste FROM workers WHERE id = ?")
    .get(s.workerId) as { poste: string } | undefined;
  const shifts = db
    .prepare("SELECT * FROM shifts WHERE worker_id = ? ORDER BY date DESC LIMIT 30")
    .all(s.workerId);
  return json({ name: s.name, poste: w?.poste || "", shifts });
}
