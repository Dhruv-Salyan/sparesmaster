// src/controllers/authController.js
// ─────────────────────────────────────────────────────────────────────────────
// Authentication controller.
// Handles: register, login, logout, /me, forgotPassword, resetPassword.
// ─────────────────────────────────────────────────────────────────────────────

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');
const logger = require('../utils/logger');
const { ok, fail } = require('../utils/apiResponse');

const JWT_SECRET  = process.env.JWT_SECRET  || 'change_me_in_production_please';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ── Helper: sign a JWT ────────────────────────────────────────────────────────
function signToken(userId, rememberMe = false) {
  const expiresIn = rememberMe ? '30d' : JWT_EXPIRES;
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn });
}

// ── Helper: set auth cookie ───────────────────────────────────────────────────
function setAuthCookie(res, token, rememberMe = false) {
  const maxAge = rememberMe
    ? 30 * 24 * 60 * 60 * 1000   // 30 days
    : 7  * 24 * 60 * 60 * 1000;  // 7 days

  res.cookie('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
  });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { fullName, email, password } = req.body;

    // Check for duplicate email
    const existing = User.findByEmail(email);
    if (existing) {
      return res.status(409).json(fail('An account with this email already exists'));
    }

    const user  = await User.create({ fullName, email, password });
    const token = signToken(user.id);
    setAuthCookie(res, token);

    logger.info(`New user registered: ${email}`);
    return res.status(201).json(ok('Account created successfully', {
      user: { id: user.id, fullName: user.fullName, email: user.email },
      token,
    }));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password, rememberMe = false } = req.body;

    const user = User.findByEmail(email);
    if (!user) {
      return res.status(401).json(fail('Invalid email or password'));
    }

    const passwordOk = await User.verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json(fail('Invalid email or password'));
    }

    const token = signToken(user.id, rememberMe);
    setAuthCookie(res, token, rememberMe);

    logger.info(`User logged in: ${email}`);
    return res.status(200).json(ok('Login successful', {
      user: { id: user.id, fullName: user.full_name, email: user.email },
      token,
    }));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
function logout(req, res) {
  res.clearCookie('token');
  return res.status(200).json(ok('Logged out successfully'));
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
function me(req, res) {
  // req.user is set by the authenticate middleware
  return res.status(200).json(ok('Authenticated', { user: req.user }));
}

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = User.findByEmail(email);

    // Always respond 200 to avoid user-enumeration attacks
    if (!user) {
      return res.status(200).json(ok(
        'If that email exists, a reset link has been sent'
      ));
    }

    const token = crypto.randomBytes(32).toString('hex');
    User.setResetToken(user.id, token);

    // In production: send email via your mail provider.
    // For now we log the token so you can test it via the API.
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${token}`;
    logger.info(`Password reset link for ${email}: ${resetUrl}`);

    return res.status(200).json(ok(
      'If that email exists, a reset link has been sent',
      // Remove `devToken` in production!
      process.env.NODE_ENV !== 'production' ? { devToken: token, resetUrl } : undefined
    ));
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/reset-password ────────────────────────────────────────────
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    const user = User.findByResetToken(token);
    if (!user) {
      return res.status(400).json(fail('Reset link is invalid or has already been used'));
    }

    // Check expiry
    const expiry = new Date(user.reset_token_expiry).getTime();
    if (Date.now() > expiry) {
      return res.status(400).json(fail('Reset link has expired. Please request a new one'));
    }

    await User.resetPassword(user.id, password);

    logger.info(`Password reset successful for user ${user.id}`);
    return res.status(200).json(ok('Password updated successfully. You can now log in.'));
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, me, forgotPassword, resetPassword };
