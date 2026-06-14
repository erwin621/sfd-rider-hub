// db/pool.js
// Neon PostgreSQL connection via node-postgres (pg)
// Uses connection pooling for efficient query handling.

'use strict';

require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check your .env file.');
}

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Neon requires SSL in all environments
  ssl: {
    rejectUnauthorized: isProduction, // strict in prod, relaxed in dev
  },

  // Pool sizing — tune for your Neon plan
  max: 10,          // max connections in pool
  idleTimeoutMillis: 30_000,   // close idle connections after 30s
  connectionTimeoutMillis: 5_000, // fail fast if DB unreachable
});

// Log connection events in development
pool.on('connect', (client) => {
  if (!isProduction) {
    console.log('[DB] New client connected to Neon PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Run a single query.
 * @param {string} text  - SQL query string with $1, $2… placeholders
 * @param {Array}  params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    if (!isProduction) {
      const duration = Date.now() - start;
      console.log(`[DB] query(${duration}ms) rows=${result.rowCount} — ${text.slice(0, 80)}`);
    }
    return result;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

/**
 * Get a dedicated client for transactions (BEGIN/COMMIT/ROLLBACK).
 * Always call client.release() in a finally block.
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

module.exports = { pool, query, getClient };
