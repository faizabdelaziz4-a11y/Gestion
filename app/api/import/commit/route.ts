import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, bad, requireOwnerBusiness, isResponse } from "@/lib/api";
import { Field, toNumber, toIsoDate } from "@/lib/import";

// Validation : reçoit les lignes + le mappage, écrit dans revenue/cash (source 'import').
export async function POST(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const b = await req.json().catch(() => ({}));
  const rows: Record<string, string>[] = b.rows || [];
  const mapping: Record<Field, string | null> = b.mapping || {};
  if (!mapping.date) return bad("La colonne Date doit être mappée");

  const upRevenue = db.prepare(
    `INSERT INTO revenue (business_id, date, ca, margin_pct, platform_ca, platform_rate, source, note)
     VALUES (@business_id, @date, @ca, @margin_pct, @platform_ca, 0.17, 'import', NULL)
     ON CONFLICT(business_id, date) DO UPDATE SET
       ca = excluded.ca, margin_pct = excluded.margin_pct,
       platform_ca = excluded.platform_ca, source = 'import'`
  );
  const upCash = db.prepare(
    `INSERT INTO cash (business_id, date, opening, expected_cash, closing, source, note)
     VALUES (@business_id, @date, @opening, @expected_cash, @closing, 'import', NULL)
     ON CONFLICT(business_id, date) DO UPDATE SET
       opening = excluded.opening, closing = excluded.closing, source = 'import'`
  );

  let revCount = 0;
  let cashCount = 0;
  const errors: string[] = [];

  const tx = db.transaction(() => {
    for (const row of rows) {
      const date = toIsoDate(row[mapping.date!] || "");
      if (!date) {
        errors.push(`Date illisible: "${row[mapping.date!]}"`);
        continue;
      }
      if (mapping.ca || mapping.platform_ca) {
        upRevenue.run({
          business_id: biz.id,
          date,
          ca: mapping.ca ? toNumber(row[mapping.ca] || "") : 0,
          margin_pct: mapping.margin_pct ? toNumber(row[mapping.margin_pct] || "") : 0,
          platform_ca: mapping.platform_ca ? toNumber(row[mapping.platform_ca] || "") : 0,
        });
        revCount++;
      }
      if (mapping.cash_closing || mapping.cash_opening) {
        upCash.run({
          business_id: biz.id,
          date,
          opening: mapping.cash_opening ? toNumber(row[mapping.cash_opening] || "") : 0,
          expected_cash: 0,
          closing: mapping.cash_closing ? toNumber(row[mapping.cash_closing] || "") : 0,
        });
        cashCount++;
      }
    }
  });
  tx();

  return json({ revCount, cashCount, errors: errors.slice(0, 20), total: rows.length });
}
