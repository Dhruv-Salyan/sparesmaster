// src/middleware/rateLimiter.js
// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting using express-rate-limit.
// Prevents API abuse and brute-force attacks.
//
// Configuration is read from .env:
//   RATE_LIMIT_WINDOW_MS  — time window in ms (default: 15 min)
//   RATE_LIMIT_MAX        — max requests per window (default: 100)
// ─────────────────────────────────────────────────────────────────────────────

const rateLimit = require('express-rate-limit');
const { fail }  = require('../utils/apiResponse');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  standardHeaders: true,   // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders:   false,  // Disable the `X-RateLimit-*` headers

  handler(req, res) {
    res.status(429).json(fail('Too many requests — please slow down and try again later'));
  },
});

module.exports = limiter;
