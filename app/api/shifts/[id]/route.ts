import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";

const FIELDS = [
  "date",
  "start_time",
  "end_time",
  "break_minutes",
  "km_start",
  "km_end",
  "note",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const values: any = { id };
  for (const f of FIELDS) {
    if (b[f] !== undefined) {
      sets.push(`${f} = @${f}`);
      values[f] = b[f] === "" ? null : b[f];
    }
  }
  if (!sets.length) return bad("Aucun champ à modifier");
  db.prepare(`UPDATE shifts SET ${sets.join(", ")} WHERE id = @id`).run(values);
  return json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const { id } = await params;
  db.prepare("DELETE FROM shifts WHERE id = ?").run(id);
  return json({ ok: true });
}
