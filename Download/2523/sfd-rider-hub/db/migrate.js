// db/migrate.js
// Run once to create the database schema on Neon.
// Usage: npm run db:migrate

'use strict';

require('dotenv').config();
const { pool } = require('./pool');

const MIGRATIONS = [
  // ── 1. Riders (users) ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS riders (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    phone         VARCHAR(30),
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── 2. Wallets (e-wallet + cash accounts) ──────────
  `CREATE TABLE IF NOT EXISTS wallets (
    id            SERIAL PRIMARY KEY,
    rider_id      INT NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    name          VARCHAR(80) NOT NULL,        -- 'GCash', 'Maribank', etc.
    wallet_type   VARCHAR(40) NOT NULL DEFAULT 'ewallet',  -- ewallet | bank | cash
    balance       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency      CHAR(3) NOT NULL DEFAULT 'PHP',
    color_class   VARCHAR(30),                 -- UI hint: 'gcash', 'maribank'…
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── 3. Transaction categories ──────────────────────
  `CREATE TABLE IF NOT EXISTS categories (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(60) UNIQUE NOT NULL,  -- 'Delivery', 'Fuel', 'Food'…
    type          VARCHAR(10) NOT NULL CHECK (type IN ('income','expense','both')),
    icon          VARCHAR(40),
    color_hex     CHAR(7)
  )`,

  // ── 4. Transactions ────────────────────────────────
  `CREATE TABLE IF NOT EXISTS transactions (
    id            SERIAL PRIMARY KEY,
    rider_id      INT NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    wallet_id     INT NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    category_id   INT REFERENCES categories(id) ON DELETE SET NULL,
    type          VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
    amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description   VARCHAR(255) NOT NULL,
    source        VARCHAR(100),               -- 'SFD', 'Lalamove', 'Shopee'…
    tx_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── 5. Indexes ─────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_transactions_rider_id  ON transactions(rider_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_tx_date   ON transactions(tx_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_type      ON transactions(type)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wallets_rider_id       ON wallets(rider_id)`,

  // ── 6. updated_at auto-update trigger ──────────────
  `CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_riders_updated_at') THEN
      CREATE TRIGGER trg_riders_updated_at
        BEFORE UPDATE ON riders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
   END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wallets_updated_at') THEN
      CREATE TRIGGER trg_wallets_updated_at
        BEFORE UPDATE ON wallets
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
   END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transactions_updated_at') THEN
      CREATE TRIGGER trg_transactions_updated_at
        BEFORE UPDATE ON transactions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
   END $$`,
];

async function migrate() {
  console.log('🚀 Running SFD Rider Hub migrations on Neon PostgreSQL…\n');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < MIGRATIONS.length; i++) {
      const sql = MIGRATIONS[i].trim();
      const preview = sql.split('\n')[0].slice(0, 72);
      process.stdout.write(`  [${i + 1}/${MIGRATIONS.length}] ${preview}… `);
      await client.query(sql);
      console.log('✓');
    }

    await client.query('COMMIT');
    console.log('\n✅ All migrations applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed, rolled back.\n', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
