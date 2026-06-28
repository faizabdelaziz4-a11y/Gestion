import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwner, isResponse } from "@/lib/api";
import { rangeFor } from "@/lib/time";

interface CashRow {
  date: string;
  opening: number;
  expected_cash: number;
  closing: number;
  note: string | null;
}

// Recette cash réelle = comptage fin − fond de caisse début.
// Écart = recette réelle − ventes espèces attendues (+ surplus / − manquant).
function withEcart(r: CashRow) {
  const recette = r.closing - r.opening;
  const ecart = recette - r.expected_cash;
  return { ...r, recette: round(recette), ecart: round(ecart) };
}
const round = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date");
  const period = sp.get("period") as "day" | "week" | "month" | null;

  if (date && !period) {
    const row = db.prepare("SELECT * FROM cash WHERE date = ?").get(date) as
      | CashRow
      | undefined;
    return json({ cash: row ? withEcart(row) : null });
  }
  if (date && period) {
    const { start, end } = rangeFor(period, date);
    const rows = db
      .prepare("SELECT * FROM cash WHERE date BETWEEN ? AND ? ORDER BY date DESC")
      .all(start, end) as CashRow[];
    return json({ cash: rows.map(withEcart) });
  }
  const rows = db
    .prepare("SELECT * FROM cash ORDER BY date DESC LIMIT 60")
    .all() as CashRow[];
  return json({ cash: rows.map(withEcart) });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const b = await req.json().catch(() => ({}));
  if (!b.date) return bad("Date requise");
  db.prepare(
    `INSERT INTO cash (date, opening, expected_cash, closing, note)
     VALUES (@date, @opening, @expected_cash, @closing, @note)
     ON CONFLICT(date) DO UPDATE SET
       opening = excluded.opening,
       expected_cash = excluded.expected_cash,
       closing = excluded.closing,
       note = excluded.note`
  ).run({
    date: b.date,
    opening: Number(b.opening) || 0,
    expected_cash: Number(b.expected_cash) || 0,
    closing: Number(b.closing) || 0,
    note: b.note || null,
  });
  const row = db.prepare("SELECT * FROM cash WHERE date = ?").get(b.date) as CashRow;
  return json({ cash: withEcart(row) });
}
