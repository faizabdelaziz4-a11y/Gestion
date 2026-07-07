import postgres from "postgres";
import crypto from "node:crypto";

/**
 * Couche base de données — PostgreSQL (Supabase).
 * Le schéma est créé automatiquement au premier accès (idempotent).
 */

const URL = process.env.DATABASE_URL || "";
const isLocal = /localhost|127\.0\.0\.1/.test(URL);

export const sql = postgres(URL, {
  ssl: URL && !isLocal ? "require" : false,
  prepare: false, // compatible pooler Supabase (mode transaction)
  max: 5,
});

let ready: Promise<void> | undefined;

/** Crée le schéma + les valeurs par défaut une seule fois. */
export async function ensureSchema(): Promise<void> {
  if (!ready) ready = migrate();
  return ready;
}

async function migrate(): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id                   SERIAL PRIMARY KEY,
      name                 TEXT NOT NULL DEFAULT 'Mon Commerce',
      opening_time         TEXT NOT NULL DEFAULT '09:00',
      closing_time         TEXT NOT NULL DEFAULT '18:00',
      region               TEXT NOT NULL DEFAULT 'Liège',
      diesel_consumption   DOUBLE PRECISION NOT NULL DEFAULT 6.4,
      default_diesel_price DOUBLE PRECISION NOT NULL DEFAULT 1.75,
      employer_onss_rate   DOUBLE PRECISION NOT NULL DEFAULT 0.25,
      onss_worker_rate     DOUBLE PRECISION NOT NULL DEFAULT 0.1307,
      onss_student_rate    DOUBLE PRECISION NOT NULL DEFAULT 0.0271,
      diesel_product       TEXT NOT NULL DEFAULT 'Diesel B7 (€/L)',
      diesel_source_url    TEXT NOT NULL DEFAULT 'https://bestat.statbel.fgov.be/bestat/api/views/9e9cf394-6c54-4d81-8013-7124a8c4bf15/result/JSON',
      ingest_token         TEXT UNIQUE,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS workers (
      id          SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      poste       TEXT NOT NULL DEFAULT 'vendeur',
      statut      TEXT NOT NULL DEFAULT 'employe',
      pay_type    TEXT NOT NULL DEFAULT 'hourly',
      pay_basis   TEXT NOT NULL DEFAULT 'net',
      base_rate   DOUBLE PRECISION NOT NULL DEFAULT 0,
      access_code TEXT UNIQUE,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id            SERIAL PRIMARY KEY,
      worker_id     INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      date          TEXT NOT NULL,
      start_time    TEXT,
      end_time      TEXT,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      km_start      DOUBLE PRECISION,
      km_end        DOUBLE PRECISION,
      photo_path    TEXT,
      open_photo    TEXT,
      close_photo   TEXT,
      source        TEXT NOT NULL DEFAULT 'manuel',
      note          TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS supplements (
      id        SERIAL PRIMARY KEY,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      date      TEXT NOT NULL,
      label     TEXT,
      amount    DOUBLE PRECISION NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS charges (
      id          SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
      label       TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'autre',
      kind        TEXT NOT NULL DEFAULT 'fixe',
      amount      DOUBLE PRECISION NOT NULL DEFAULT 0,
      period      TEXT NOT NULL DEFAULT 'mensuel',
      date        TEXT,
      active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS revenue (
      id            SERIAL PRIMARY KEY,
      business_id   INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
      date          TEXT NOT NULL,
      ca            DOUBLE PRECISION NOT NULL DEFAULT 0,
      margin_pct    DOUBLE PRECISION NOT NULL DEFAULT 0,
      platform_ca   DOUBLE PRECISION NOT NULL DEFAULT 0,
      platform_rate DOUBLE PRECISION NOT NULL DEFAULT 0.17,
      source        TEXT NOT NULL DEFAULT 'manuel',
      note          TEXT,
      UNIQUE (business_id, date)
    );

    CREATE TABLE IF NOT EXISTS diesel_prices (
      date  TEXT PRIMARY KEY,
      price DOUBLE PRECISION NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash (
      business_id   INTEGER NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
      date          TEXT NOT NULL,
      opening       DOUBLE PRECISION NOT NULL DEFAULT 0,
      expected_cash DOUBLE PRECISION NOT NULL DEFAULT 0,
      closing       DOUBLE PRECISION NOT NULL DEFAULT 0,
      source        TEXT NOT NULL DEFAULT 'manuel',
      note          TEXT,
      PRIMARY KEY (business_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
    CREATE INDEX IF NOT EXISTS idx_shifts_worker ON shifts(worker_id);
    CREATE INDEX IF NOT EXISTS idx_charges_biz ON charges(business_id);
    CREATE INDEX IF NOT EXISTS idx_workers_biz ON workers(business_id);
  `);

  // Valeurs par défaut (idempotent).
  await sql`INSERT INTO settings (key, value) VALUES ('owner_password', 'admin') ON CONFLICT (key) DO NOTHING`;
  const count = (await sql`SELECT count(*)::int AS n FROM businesses`)[0].n as number;
  if (count === 0) {
    await sql`INSERT INTO businesses (name, ingest_token) VALUES ('Mon Commerce', ${randomToken()})`;
  }
  // Jeton d'ingestion pour les commerces qui n'en ont pas.
  const noTok = await sql`SELECT id FROM businesses WHERE ingest_token IS NULL`;
  for (const b of noTok) {
    await sql`UPDATE businesses SET ingest_token = ${randomToken()} WHERE id = ${b.id}`;
  }
}

export function randomToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ---- settings helpers ----
export async function getSetting(key: string, fallback = ""): Promise<string> {
  const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
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

export async function listBusinesses(): Promise<Business[]> {
  return (await sql`SELECT * FROM businesses ORDER BY id`) as unknown as Business[];
}

export async function getBusiness(id: number): Promise<Business | undefined> {
  const rows = await sql`SELECT * FROM businesses WHERE id = ${id}`;
  return rows[0] as unknown as Business | undefined;
}

export async function firstBusinessId(): Promise<number> {
  const rows = await sql`SELECT id FROM businesses ORDER BY id LIMIT 1`;
  return (rows[0]?.id as number) ?? 1;
}

export async function getBusinessByToken(token: string): Promise<Business | undefined> {
  const rows = await sql`SELECT * FROM businesses WHERE ingest_token = ${token}`;
  return rows[0] as unknown as Business | undefined;
}
