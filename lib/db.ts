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

    CREATE TABLE IF NOT EXISTS workers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
      label     TEXT NOT NULL,
      category  TEXT NOT NULL DEFAULT 'autre',         -- electricite, comptable, loyer, assurance, ...
      kind      TEXT NOT NULL DEFAULT 'fixe',          -- fixe | variable
      amount    REAL NOT NULL DEFAULT 0,
      period    TEXT NOT NULL DEFAULT 'mensuel',       -- journalier | hebdomadaire | mensuel | annuel | ponctuel
      date      TEXT,                                  -- pour ponctuel / variable daté
      active    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS revenue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL UNIQUE,                 -- YYYY-MM-DD
      ca         REAL NOT NULL DEFAULT 0,              -- chiffre d'affaires du jour
      margin_pct REAL NOT NULL DEFAULT 0,              -- marge commerciale en %
      note       TEXT
    );

    CREATE TABLE IF NOT EXISTS diesel_prices (
      date  TEXT PRIMARY KEY,                          -- YYYY-MM-DD
      price REAL NOT NULL                              -- €/litre à Liège
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
    CREATE INDEX IF NOT EXISTS idx_shifts_worker ON shifts(worker_id);
    CREATE INDEX IF NOT EXISTS idx_charges_date ON charges(date);
    CREATE INDEX IF NOT EXISTS idx_supp_date ON supplements(date);
  `);
}

function seedDefaults(db: Database.Database) {
  const defaults: Record<string, string> = {
    business_name: "Mon Commerce",
    owner_password: "admin", // à changer dans Réglages
    diesel_consumption: "6.4", // L / 100 km
    default_diesel_price: "1.75", // €/L (fallback si pas de prix du jour)
    employer_onss_rate: "0.25", // cotisation patronale ONSS approximative
    onss_worker_rate: "0.1307", // cotisation travailleur (employé/ouvrier)
    onss_student_rate: "0.0271", // cotisation de solidarité étudiant
    region: "Liège",
  };
  const insert = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(defaults)) insert.run(k, v);
  });
  tx();
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
