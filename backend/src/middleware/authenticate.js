// src/middleware/authenticate.js
// ─────────────────────────────────────────────────────────────────────────────
// JWT authentication middleware.
// Reads the token from:
//   1. Authorization: Bearer <token>  header  (API clients / Postman)
//   2. Cookie named "token"                    (browser sessions)
//
// On success: attaches req.user = { id, fullName, email } and calls next().
// On failure: returns 401 JSON.
// ─────────────────────────────────────────────────────────────────────────────

const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { fail } = require('../utils/apiResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production_please';

async function authenticate(req, res, next) {
  // ── Extract token ─────────────────────────────────────────────────────────
  let token;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json(fail('Authentication required. Please log in.'));
  }

  // ── Verify token ──────────────────────────────────────────────────────────
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid session. Please log in again.';
    return res.status(401).json(fail(message));
  }

  // ── Load user ─────────────────────────────────────────────────────────────
  const user = User.findById(payload.sub);
  if (!user) {
    return res.status(401).json(fail('User no longer exists. Please register again.'));
  }

  // Attach clean user object to request (no password_hash)
  req.user = {
    id:       user.id,
    fullName: user.full_name,
    email:    user.email,
  };

  next();
}

module.exports = authenticate;
