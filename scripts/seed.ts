/**
 * Données de démonstration. Lancer : npm run seed
 * (n'écrase rien d'existant si déjà présent grâce aux INSERT OR IGNORE).
 */
import { db, setSetting } from "../lib/db";

setSetting("business_name", "Friterie du Coin");

const insertWorker = db.prepare(
  `INSERT INTO workers (name, poste, statut, pay_type, pay_basis, base_rate, access_code)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const workers: any[] = [
  ["Sophie Martin", "vendeur", "employe", "hourly", "net", 12.5, "VEND01"],
  ["Karim Benali", "livreur", "etudiant", "hourly", "net", 11, "LIVR02"],
  ["Luc Dubois", "cuisine", "employe", "monthly", "net", 2100, "CUIS03"],
];
for (const w of workers) {
  const exists = db.prepare("SELECT 1 FROM workers WHERE access_code = ?").get(w[6]);
  if (!exists) insertWorker.run(...w);
}

const insertCharge = db.prepare(
  `INSERT INTO charges (label, category, kind, amount, period) VALUES (?, ?, ?, ?, ?)`
);
const charges: any[] = [
  ["Électricité", "electricite", "variable", 450, "mensuel"],
  ["Loyer", "loyer", "fixe", 1400, "mensuel"],
  ["Comptable", "comptable", "fixe", 180, "mensuel"],
  ["Assurance", "assurance", "fixe", 1200, "annuel"],
  ["Marchandises", "marchandises", "variable", 300, "journalier"],
];
for (const c of charges) {
  const exists = db.prepare("SELECT 1 FROM charges WHERE label = ?").get(c[0]);
  if (!exists) insertCharge.run(...c);
}

// Prix diesel du jour
const today = new Date().toISOString().slice(0, 10);
db.prepare(
  "INSERT OR IGNORE INTO diesel_prices (date, price) VALUES (?, ?)"
).run(today, 1.739);

// Quelques jours de CA
const rev = db.prepare(
  `INSERT OR IGNORE INTO revenue (date, ca, margin_pct) VALUES (?, ?, ?)`
);
for (let i = 0; i < 14; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const date = d.toISOString().slice(0, 10);
  rev.run(date, 800 + Math.round(Math.random() * 600), 38);
}

console.log("✓ Données de démonstration insérées.");
