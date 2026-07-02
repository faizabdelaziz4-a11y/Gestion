import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Singleton DB connection. In dev, Next reloads modules, so we cache on global.
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "gestion.db");

function init(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedDefaults(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT NOT NULL DEFAULT 'Mon Commerce',
      opening_time         TEXT NOT NULL DEFAULT '09:00',   -- heure d'ouverture
      closing_time         TEXT NOT NULL DEFAULT '18:00',   -- heure de fermeture
      region               TEXT NOT NULL DEFAULT 'Liège',
      diesel_consumption   REAL NOT NULL DEFAULT 6.4,        -- L / 100 km
      default_diesel_price REAL NOT NULL DEFAULT 1.75,       -- €/L (repli)
      employer_onss_rate   REAL NOT NULL DEFAULT 0.25,
      onss_worker_rate     REAL NOT NULL DEFAULT 0.1307,
      onss_student_rate    REAL NOT NULL DEFAULT 0.0271,
      diesel_product       TEXT NOT NULL DEFAULT 'Diesel B7 (€/L)',
      diesel_source_url    TEXT NOT NULL DEFAULT 'https://bestat.statbel.fgov.be/bestat/api/views/9e9cf394-6c54-4d81-8013-7124a8c4bf15/result/JSON',
      ingest_token         TEXT UNIQUE,                      -- jeton d'ingestion API (caisse auto / POS)
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      poste       TEXT NOT NULL DEFAULT 'vendeur',     -- vendeur, livreur, cuisine, ...
      statut      TEXT NOT NULL DEFAULT 'employe',     -- employe, etudiant, flexi, independant
      pay_type    TEXT NOT NULL DEFAULT 'hourly',      -- hourly | monthly
      pay_basis   TEXT NOT NULL DEFAULT 'net',         -- le montant saisi est un net ou un brut
      base_rate   REAL NOT NULL DEFAULT 0,             -- taux horaire OU salaire mensuel (selon pay_type)
      access_code TEXT UNIQUE,                         -- code d'accès limité du travailleur
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id     INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      date          TEXT NOT NULL,                     -- YYYY-MM-DD
      start_time    TEXT,                              -- HH:MM
      end_time      TEXT,                              -- HH:MM
      break_minutes INTEGER NOT NULL DEFAULT 0,
      km_start      REAL,                              -- livreurs uniquement
      km_end        REAL,
      photo_path    TEXT,                              -- photo du tableau de bord / horaire importé
      source        TEXT NOT NULL DEFAULT 'manuel',    -- manuel | travailleur | photo
      note          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supplements (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      date      TEXT NOT NULL,
      label     TEXT,
      amount    REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS charges (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
      label     TEXT NOT NULL,
      category  TEXT NOT NULL DEFAULT 'autre',         -- electricite, comptable, loyer, assurance, ...
      kind      TEXT NOT NULL DEFAULT 'fixe',          -- fixe | variable
      amount    REAL NOT NULL DEFAULT 0,
      period    TEXT NOT NULL DEFAULT 'mensuel',       -- journalier | hebdomadaire | mensuel | annuel | ponctuel
      date      TEXT,                                  -- pour ponctuel / variable daté
      active    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS revenue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
      date          TEXT NOT NULL,                     -- YYYY-MM-DD
      ca            REAL NOT NULL DEFAULT 0,           -- chiffre d'affaires du jour
      margin_pct    REAL NOT NULL DEFAULT 0,           -- marge commerciale en %
      platform_ca   REAL NOT NULL DEFAULT 0,           -- part du CA via plateforme (livraison)
      platform_rate REAL NOT NULL DEFAULT 0.17,        -- commission plateforme (17 % par défaut)
      source        TEXT NOT NULL DEFAULT 'manuel',    -- manuel | import | api
      note          TEXT,
      UNIQUE(business_id, date)
    );

    CREATE TABLE IF NOT EXISTS diesel_prices (
      date  TEXT PRIMARY KEY,                          -- YYYY-MM-DD
      price REAL NOT NULL                              -- €/litre à Liège
    );

    CREATE TABLE IF NOT EXISTS cash (
      business_id   INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
      date          TEXT NOT NULL,                     -- YYYY-MM-DD
      opening       REAL NOT NULL DEFAULT 0,           -- fond de caisse (début)
      expected_cash REAL NOT NULL DEFAULT 0,           -- ventes espèces attendues (soirée)
      closing       REAL NOT NULL DEFAULT 0,           -- caisse comptée (fin de soirée)
      source        TEXT NOT NULL DEFAULT 'manuel',    -- manuel | import | api
      note          TEXT,
      PRIMARY KEY (business_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
    CREATE INDEX IF NOT EXISTS idx_shifts_worker ON shifts(worker_id);
    CREATE INDEX IF NOT EXISTS idx_charges_date ON charges(date);
    CREATE INDEX IF NOT EXISTS idx_charges_biz ON charges(business_id);
    CREATE INDEX IF NOT EXISTS idx_workers_biz ON workers(business_id);
    CREATE INDEX IF NOT EXISTS idx_supp_date ON supplements(date);
  `);
  patchSchema(db);
}

function hasColumn(db: Database.Database, table: string, col: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return cols.some((c) => c.name === col);
}

/**
 * Migration des bases mono-commerce existantes vers le multi-commerce.
 * Idempotente : n'agit que si les colonnes/tables ne sont pas déjà à jour.
 */
function patchSchema(db: Database.Database) {
  // Défensif : au build, des workers parallèles peuvent lancer la même
  // migration en même temps → on ignore les erreurs "déjà existant".
  const safe = (sql: string) => {
    try {
      db.exec(sql);
    } catch (e: any) {
      const m = String(e?.message || e);
      if (!/duplicate column|already exists/i.test(m)) throw e;
    }
  };

  // Ajout des colonnes business_id manquantes (anciennes bases).
  for (const t of ["workers", "charges"]) {
    if (!hasColumn(db, t, "business_id")) {
      safe(`ALTER TABLE ${t} ADD COLUMN business_id INTEGER NOT NULL DEFAULT 1`);
    }
  }
  // revenue : reconstruite si l'ancienne unicité globale (pas de business_id).
  if (!hasColumn(db, "revenue", "business_id")) {
    safe(`
      ALTER TABLE revenue RENAME TO revenue_old;
      CREATE TABLE revenue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
        date TEXT NOT NULL, ca REAL NOT NULL DEFAULT 0, margin_pct REAL NOT NULL DEFAULT 0,
        platform_ca REAL NOT NULL DEFAULT 0, platform_rate REAL NOT NULL DEFAULT 0.17,
        source TEXT NOT NULL DEFAULT 'manuel', note TEXT, UNIQUE(business_id, date)
      );
      INSERT INTO revenue (id, business_id, date, ca, margin_pct, note)
        SELECT id, 1, date, ca, margin_pct, note FROM revenue_old;
      DROP TABLE revenue_old;
    `);
  }
  // Commission plateforme : ajout sur les bases déjà multi-commerce.
  if (hasColumn(db, "revenue", "business_id") && !hasColumn(db, "revenue", "platform_ca")) {
    safe("ALTER TABLE revenue ADD COLUMN platform_ca REAL NOT NULL DEFAULT 0");
    safe("ALTER TABLE revenue ADD COLUMN platform_rate REAL NOT NULL DEFAULT 0.17");
  }
  // cash : reconstruite si l'ancienne PK globale (pas de business_id).
  if (!hasColumn(db, "cash", "business_id")) {
    safe(`
      ALTER TABLE cash RENAME TO cash_old;
      CREATE TABLE cash (
        business_id INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
        date TEXT NOT NULL, opening REAL NOT NULL DEFAULT 0, expected_cash REAL NOT NULL DEFAULT 0,
        closing REAL NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manuel', note TEXT,
        PRIMARY KEY (business_id, date)
      );
      INSERT INTO cash (business_id, date, opening, expected_cash, closing, note)
        SELECT 1, date, opening, expected_cash, closing, note FROM cash_old;
      DROP TABLE cash_old;
    `);
  }
}

function seedDefaults(db: Database.Database) {
  // Réglages globaux (ne dépendent pas d'un commerce).
  const defaults: Record<string, string> = {
    owner_password: "admin", // à changer dans Réglages
  };
  const insert = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(defaults)) insert.run(k, v);
  });
  tx();

  // Au moins un commerce. Récupère le nom/région de l'ancienne config si présente.
  const count = (
    db.prepare("SELECT COUNT(*) AS n FROM businesses").get() as { n: number }
  ).n;
  if (count === 0) {
    const oldName =
      (db.prepare("SELECT value FROM settings WHERE key='business_name'").get() as
        | { value: string }
        | undefined)?.value || "Mon Commerce";
    db.prepare(
      "INSERT INTO businesses (id, name, ingest_token) VALUES (1, ?, ?)"
    ).run(oldName, randomToken());
  }
  // Jeton d'ingestion pour les commerces qui n'en ont pas.
  const noToken = db
    .prepare("SELECT id FROM businesses WHERE ingest_token IS NULL")
    .all() as Array<{ id: number }>;
  for (const b of noToken) {
    db.prepare("UPDATE businesses SET ingest_token = ? WHERE id = ?").run(
      randomToken(),
      b.id
    );
  }
}

function randomToken(): string {
  return require("node:crypto").randomBytes(16).toString("hex");
}

declare global {
  // eslint-disable-next-line no-var
  var __gestion_db: Database.Database | undefined;
}

export const db: Database.Database = global.__gestion_db ?? init();
if (process.env.NODE_ENV !== "production") global.__gestion_db = db;

// ---- settings helpers ----
export function getSetting(key: string, fallback = ""): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function getNumberSetting(key: string, fallback = 0): number {
  const v = parseFloat(getSetting(key, String(fallback)));
  return Number.isFinite(v) ? v : fallback;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

// ---- businesses (commerces) ----
export interface Business {
  id: number;
  name: string;
  opening_time: string;
  closing_time: string;
  region: string;
  diesel_consumption: number;
  default_diesel_price: number;
  employer_onss_rate: number;
  onss_worker_rate: number;
  onss_student_rate: number;
  diesel_product: string;
  diesel_source_url: string;
  ingest_token: string;
  created_at: string;
}

export function listBusinesses(): Business[] {
  return db
    .prepare("SELECT * FROM businesses ORDER BY id")
    .all() as Business[];
}

export function getBusiness(id: number): Business | undefined {
  return db.prepare("SELECT * FROM businesses WHERE id = ?").get(id) as
    | Business
    | undefined;
}

export function firstBusinessId(): number {
  const row = db.prepare("SELECT id FROM businesses ORDER BY id LIMIT 1").get() as
    | { id: number }
    | undefined;
  return row?.id ?? 1;
}

export function getBusinessByToken(token: string): Business | undefined {
  return db.prepare("SELECT * FROM businesses WHERE ingest_token = ?").get(token) as
    | Business
    | undefined;
}
