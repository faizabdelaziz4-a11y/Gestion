/**
 * Données de démonstration (PostgreSQL / Supabase).
 * Lancer : DATABASE_URL=... npm run seed
 */
import { sql, ensureSchema, randomToken } from "../lib/db";

async function main() {
  await ensureSchema();

  // Commerce 1 (par défaut) renommé + un 2e commerce de démo.
  await sql`UPDATE businesses SET name = 'Friterie du Coin' WHERE id = 1`;
  const second = await sql`SELECT id FROM businesses WHERE name = 'Snack Centre-Ville'`;
  if (!second.length) {
    await sql`INSERT INTO businesses (name, region, ingest_token)
              VALUES ('Snack Centre-Ville', 'Liège', ${randomToken()})`;
  }

  const workers: Array<[string, string, string, string, string, number, string]> = [
    ["Sophie Martin", "vendeur", "employe", "hourly", "net", 12.5, "VEND01"],
    ["Karim Benali", "livreur", "etudiant", "hourly", "net", 11, "LIVR02"],
    ["Luc Dubois", "cuisine", "employe", "monthly", "net", 2100, "CUIS03"],
  ];
  for (const [name, poste, statut, pay_type, pay_basis, rate, code] of workers) {
    const ex = await sql`SELECT 1 FROM workers WHERE access_code = ${code}`;
    if (!ex.length)
      await sql`INSERT INTO workers (business_id, name, poste, statut, pay_type, pay_basis, base_rate, access_code)
                VALUES (1, ${name}, ${poste}, ${statut}, ${pay_type}, ${pay_basis}, ${rate}, ${code})`;
  }

  const charges: Array<[string, string, string, number, string]> = [
    ["Électricité", "electricite", "variable", 450, "mensuel"],
    ["Loyer", "loyer", "fixe", 1400, "mensuel"],
    ["Comptable", "comptable", "fixe", 180, "mensuel"],
    ["Assurance", "assurance", "fixe", 1200, "annuel"],
    ["Marchandises", "marchandises", "variable", 300, "journalier"],
  ];
  for (const [label, category, kind, amount, period] of charges) {
    const ex = await sql`SELECT 1 FROM charges WHERE label = ${label} AND business_id = 1`;
    if (!ex.length)
      await sql`INSERT INTO charges (business_id, label, category, kind, amount, period)
                VALUES (1, ${label}, ${category}, ${kind}, ${amount}, ${period})`;
  }

  const today = new Date().toISOString().slice(0, 10);
  await sql`INSERT INTO diesel_prices (date, price) VALUES (${today}, 1.739)
            ON CONFLICT (date) DO NOTHING`;

  for (let i = 0; i < 40; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const weekend = [5, 6].includes(d.getDay());
    const base = weekend ? 1300 : 950;
    const ca = Math.max(0, base + Math.round((Math.random() - 0.3) * 600));
    const margin = 36 + Math.round(Math.random() * 8);
    const platform = Math.round(ca * (0.1 + Math.random() * 0.3));
    await sql`INSERT INTO revenue (business_id, date, ca, margin_pct, platform_ca, platform_rate)
              VALUES (1, ${date}, ${ca}, ${margin}, ${platform}, 0.17)
              ON CONFLICT (business_id, date) DO NOTHING`;
  }

  console.log("✓ Données de démonstration insérées.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
