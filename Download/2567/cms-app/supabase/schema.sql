-- ═══════════════════════════════════════════════════
-- Site CMS — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- SITES — master site registry
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,          -- e.g. L4-003-04D4A
  site_name   text NOT NULL,
  locality    text NOT NULL,
  coordinates text,                          -- "14.65, 120.96"
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_sites_locality ON sites(locality);
CREATE INDEX idx_sites_code     ON sites(code);

-- ─────────────────────────────────────────
-- VISITS — field visit log (main DB sheet)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visited_by         text NOT NULL,
  visit_date         date NOT NULL,
  site_code          text NOT NULL REFERENCES sites(code) ON UPDATE CASCADE,
  site_name          text NOT NULL,          -- denormalized for fast reads
  locality           text NOT NULL,
  coordinates        text,
  power_check        boolean,
  connectivity_check boolean,
  hardware_check     boolean,
  cables_check       boolean,
  remarks            text,
  income             numeric(10,2) DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_visits_date      ON visits(visit_date DESC);
CREATE INDEX idx_visits_locality  ON visits(locality);
CREATE INDEX idx_visits_tech      ON visits(visited_by);
CREATE INDEX idx_visits_site_code ON visits(site_code);

-- ─────────────────────────────────────────
-- WATCHLIST — sites needing attention
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code    text NOT NULL,
  site_name    text NOT NULL,
  locality     text NOT NULL,
  issue        text NOT NULL,
  date_added   date DEFAULT CURRENT_DATE,
  resolved     boolean DEFAULT false,
  resolved_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_watchlist_resolved ON watchlist(resolved);

-- ─────────────────────────────────────────
-- EXPENSES — period expense config
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label   text NOT NULL,              -- e.g. "Jun 1–15, 2026"
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  ca_amount      numeric(10,2) DEFAULT 0,    -- cash advance
  motor_amount   numeric(10,2) DEFAULT 0,    -- motor allowance
  gas_amount     numeric(10,2) DEFAULT 0,    -- gas allowance
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────
-- TECHNICIANS — user registry
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS technicians (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username     text UNIQUE NOT NULL,         -- e.g. EBANOG
  display_name text,
  role         text DEFAULT 'technician',    -- technician | admin
  bank         text,
  contact      text,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────
-- VIEWS — computed summaries
-- ─────────────────────────────────────────

-- Period summary: income & visit count per day
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  visit_date,
  COUNT(*)                           AS visit_count,
  SUM(income)                        AS total_income,
  COUNT(*) FILTER (WHERE connectivity_check = true)  AS connectivity_ok,
  COUNT(*) FILTER (WHERE connectivity_check = false) AS connectivity_fail
FROM visits
GROUP BY visit_date
ORDER BY visit_date;

-- City summary: visits & income per locality
CREATE OR REPLACE VIEW city_summary AS
SELECT
  locality,
  COUNT(*)       AS visit_count,
  SUM(income)    AS total_income,
  MAX(visit_date) AS last_visit
FROM visits
GROUP BY locality
ORDER BY visit_count DESC;

-- Technician summary
CREATE OR REPLACE VIEW tech_summary AS
SELECT
  visited_by AS technician,
  COUNT(*)   AS visit_count,
  SUM(income) AS total_income
FROM visits
GROUP BY visited_by
ORDER BY visit_count DESC;

-- ─────────────────────────────────────────
-- ROW-LEVEL SECURITY (optional)
-- ─────────────────────────────────────────
-- Uncomment after setting up Supabase Auth:
--
-- ALTER TABLE visits     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sites      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE watchlist  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses   ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Public read" ON visits FOR SELECT USING (true);
-- CREATE POLICY "Auth insert"  ON visits FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Auth update"  ON visits FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "Auth delete"  ON visits FOR DELETE USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- UPDATED_AT trigger
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sites_updated  BEFORE UPDATE ON sites  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
