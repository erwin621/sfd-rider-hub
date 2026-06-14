// server.js
// SFD Rider Hub — Express + Neon PostgreSQL API Server
// ─────────────────────────────────────────────────────

'use strict';

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const { pool }          = require('./db/pool');
const { errorHandler }  = require('./middleware/errorHandler');

const ridersRouter       = require('./routes/riders');
const walletsRouter      = require('./routes/wallets');
const transactionsRouter = require('./routes/transactions');
const categoriesRouter   = require('./routes/categories');

// ─────────────────────────────────────────────────────
// App instance
// ─────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;
const ENV  = process.env.NODE_ENV || 'development';

// ─────────────────────────────────────────────────────
// Security — Helmet sets safe HTTP headers
// ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // allow the HTML file to load
}));

// ─────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, same-origin)
    if (!origin) return callback(null, true);
    if (ENV === 'development' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─────────────────────────────────────────────────────
// Body parsing
// ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
});
app.use('/api/', limiter);

// ─────────────────────────────────────────────────────
// Serve the frontend HTML file
// ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────
// Request logger (dev only)
// ─────────────────────────────────────────────────────
if (ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ─────────────────────────────────────────────────────
// Health check — useful for Neon cold-start verification
// GET /health
// ─────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW() AS server_time');
    res.json({
      status:   'ok',
      env:       ENV,
      node:      process.version,
      db: {
        connected:   true,
        server_time: dbRes.rows[0].server_time,
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      db: { connected: false, error: err.message },
    });
  }
});

// ─────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────
app.use('/api/riders',       ridersRouter);
app.use('/api/wallets',      walletsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/categories',   categoriesRouter);

// ─────────────────────────────────────────────────────
// API root info
// GET /api
// ─────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    name:    'SFD Rider Hub API',
    version: '1.0.0',
    routes: {
      health:       'GET  /health',
      riders:       'GET|POST|PATCH  /api/riders',
      wallets:      'GET|POST|PATCH|DELETE  /api/wallets',
      transactions: 'GET|POST|PATCH|DELETE  /api/transactions',
      summary:      'GET  /api/transactions/summary?rider_id=1&month=2024-07',
      daily:        'GET  /api/transactions/daily?rider_id=1&month=2024-07',
      categories:   'GET  /api/categories',
    },
  });
});

// ─────────────────────────────────────────────────────
// SPA fallback — serve index.html for all unknown routes
// ─────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─────────────────────────────────────────────────────
// Global error handler (must be last)
// ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   SFD Rider Hub API — ${ENV.toUpperCase().padEnd(14)}   ║
║   http://localhost:${PORT}               ║
╚════════════════════════════════════════╝

  /health     → DB connectivity check
  /api        → Route index
  /api/transactions/summary?rider_id=1&month=2024-07

  DB: ${process.env.DATABASE_URL ? '✓ DATABASE_URL loaded' : '✗ DATABASE_URL MISSING'}
`);
});

// ─────────────────────────────────────────────────────
// Graceful shutdown on SIGTERM / SIGINT
// ─────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully…`);
  await pool.end();
  console.log('[DB] Pool closed.');
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app; // for testing
