-- Schéma PostgreSQL (référence). L'application crée ces tables automatiquement
-- au premier accès ; ce fichier est fourni si vous préférez le lancer à la main
-- dans l'éditeur SQL de Supabase.

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

-- Valeurs par défaut
INSERT INTO settings (key, value) VALUES ('owner_password', 'admin')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO businesses (name, ingest_token)
  SELECT 'Mon Commerce', md5(random()::text || clock_timestamp()::text)
  WHERE NOT EXISTS (SELECT 1 FROM businesses);
