// db/pool.js
// Neon PostgreSQL connection via node-postgres (pg)
// Handles Neon free-tier auto-suspend (ECONNABORTED / ECONNRESET)
// by automatically retrying once on connection errors.

'use strict';

require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check your .env file.');
}

const isProduction = process.env.NODE_ENV === 'production';

// Errors that mean "Neon woke up mid-query" — safe to retry once
const RETRYABLE = ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ETIMEDOUT', '57P01'];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: { rejectUnauthorized: false }, // works for both dev and prod on Neon

  max: 3,                        // Neon free tier: keep pool small
  idleTimeoutMillis:  10_000,    // drop idle connections quickly (10s)
  connectionTimeoutMillis: 10_000, // wait up to 10s for cold-start wake
  allowExitOnIdle: true,         // let process exit cleanly
});

pool.on('connect', () => {
  if (!isProduction) console.log('[DB] Connected to Neon PostgreSQL');
});

// Log but don't crash on pool-level errors (Neon suspend events)
pool.on('error', (err) => {
  if (!RETRYABLE.includes(err.code)) {
    console.error('[DB] Pool error:', err.message);
  }
});

/**
 * Run a SQL query with automatic one-shot retry on Neon suspend errors.
 */
async function query(text, params) {
  const start = Date.now();

  const attempt = async () => {
    const result = await pool.query(text, params);
    if (!isProduction) {
      console.log(`[DB] ${Date.now() - start}ms rows=${result.rowCount} — ${text.slice(0, 72)}`);
    }
    return result;
  };

  try {
    return await attempt();
  } catch (err) {
    const retryable = RETRYABLE.includes(err.code) || RETRYABLE.includes(err.errno);
    if (retryable) {
      console.warn('[DB] Connection dropped (Neon cold-start?), retrying…');
      await new Promise(r => setTimeout(r, 800)); // brief pause for Neon to wake
      return await attempt();                      // one retry
    }
    console.error('[DB] Query error:', err.message);
    throw err;
  }
}

/**
 * Get a client for manual BEGIN/COMMIT/ROLLBACK transactions.
 * Always release() in a finally block.
 */
async function getClient() {
  return pool.connect();
}

module.exports = { pool, query, getClient };
