// middleware/errorHandler.js
// Global Express error handler — always returns clean JSON.
// Handles Neon-specific connection drop errors with a helpful message.

'use strict';

const NEON_CONN_ERRORS = ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ETIMEDOUT', '57P01'];

function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // Neon auto-suspend / connection dropped
  if (NEON_CONN_ERRORS.includes(err.code) || NEON_CONN_ERRORS.includes(err.errno)) {
    console.warn('[DB] Neon connection dropped, client should retry.');
    return res.status(503).json({
      success: false,
      message: 'Database connection was reset (Neon cold-start). Please retry.',
      retry:   true,
    });
  }

  // PostgreSQL constraint violations
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry — this record already exists.',
      detail:  isDev ? err.detail : undefined,
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
      detail:  isDev ? err.detail : undefined,
    });
  }

  // Generic server error
  const status = err.status || err.statusCode || 500;
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);

  return res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message,
    stack:   isDev ? err.stack : undefined,
  });
}

module.exports = { errorHandler };
