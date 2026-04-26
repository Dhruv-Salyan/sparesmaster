// src/middleware/errorHandler.js
// ─────────────────────────────────────────────────────────────────────────────
// Global error handler — MUST be the last app.use() in server.js.
// Any error thrown in a route or controller lands here via next(err).
//
// Error types handled:
//   - Application errors with err.status (404, 409, etc.)
//   - Unexpected server errors (500)
//   - SQLite constraint violations (mapped to 409 Conflict)
// ─────────────────────────────────────────────────────────────────────────────

const logger  = require('../utils/logger');
const { fail } = require('../utils/apiResponse');

function errorHandler(err, req, res, next) {   // eslint-disable-line no-unused-vars
  // Log every error to the console and log file
  logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, {
    status: err.status,
    stack:  err.stack,
  });

  // ── SQLite unique-constraint violation → 409 Conflict ─────────────────────
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json(fail('A record with those details already exists'));
  }

  // ── Application-level errors (thrown with err.status set) ─────────────────
  if (err.status && err.status < 500) {
    return res.status(err.status).json(fail(err.message));
  }

  // ── Unexpected server error ───────────────────────────────────────────────
  // Don't leak internal details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return res.status(500).json(fail(message));
}

module.exports = errorHandler;
