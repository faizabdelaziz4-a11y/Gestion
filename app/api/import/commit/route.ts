import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
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

  let revCount = 0;
  let cashCount = 0;
  const errors: string[] = [];

  await sql.begin(async (tx) => {
    for (const row of rows) {
      const date = toIsoDate(row[mapping.date!] || "");
      if (!date) {
        errors.push(`Date illisible: "${row[mapping.date!]}"`);
        continue;
      }
      if (mapping.ca || mapping.platform_ca) {
        await tx`
          INSERT INTO revenue (business_id, date, ca, margin_pct, platform_ca, platform_rate, source, note)
          VALUES (${biz.id}, ${date}, ${mapping.ca ? toNumber(row[mapping.ca] || "") : 0},
                  ${mapping.margin_pct ? toNumber(row[mapping.margin_pct] || "") : 0},
                  ${mapping.platform_ca ? toNumber(row[mapping.platform_ca] || "") : 0}, 0.17, 'import', NULL)
          ON CONFLICT (business_id, date) DO UPDATE SET
            ca = excluded.ca, margin_pct = excluded.margin_pct,
            platform_ca = excluded.platform_ca, source = 'import'`;
        revCount++;
      }
      if (mapping.cash_closing || mapping.cash_opening) {
        await tx`
          INSERT INTO cash (business_id, date, opening, expected_cash, closing, source, note)
          VALUES (${biz.id}, ${date}, ${mapping.cash_opening ? toNumber(row[mapping.cash_opening] || "") : 0},
                  0, ${mapping.cash_closing ? toNumber(row[mapping.cash_closing] || "") : 0}, 'import', NULL)
          ON CONFLICT (business_id, date) DO UPDATE SET
            opening = excluded.opening, closing = excluded.closing, source = 'import'`;
        cashCount++;
      }
    }
  });

  return json({ revCount, cashCount, errors: errors.slice(0, 20), total: rows.length });
}
