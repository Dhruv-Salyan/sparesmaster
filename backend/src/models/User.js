// src/models/User.js
// ─────────────────────────────────────────────────────────────────────────────
// User model — handles all DB operations for the users table.
// Uses the same db wrapper pattern as Item.js (node-sqlite3-wasm).
// ─────────────────────────────────────────────────────────────────────────────

const db     = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('crypto').webcrypto ? { v4: () => require('crypto').randomUUID() } : require('crypto');

// ── Ensure users table exists (called once at startup via database.js exec) ───
// We call this from database.js but define the SQL here for clarity.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                 TEXT    PRIMARY KEY,
    full_name          TEXT    NOT NULL,
    email              TEXT    NOT NULL UNIQUE,
    password_hash      TEXT    NOT NULL,
    remember_token     TEXT,
    reset_token        TEXT,
    reset_token_expiry TEXT,
    created_at         TEXT    NOT NULL,
    updated_at         TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function now() { return new Date().toISOString(); }
function genId() {
  try { return require('crypto').randomUUID(); }
  catch { return require('crypto').randomBytes(16).toString('hex'); }
}

// ── User model ────────────────────────────────────────────────────────────────
const User = {

  /**
   * Find a user by email (case-insensitive).
   * Returns the full row including password_hash.
   */
  findByEmail(email) {
    return db.prepare(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(:email) LIMIT 1'
    ).get({ email });
  },

  /**
   * Find a user by ID.
   * Returns the row without password_hash for safety.
   */
  findById(id) {
    return db.prepare(
      'SELECT id, full_name, email, created_at, updated_at FROM users WHERE id = :id LIMIT 1'
    ).get({ id });
  },

  /**
   * Find a user by password-reset token.
   */
  findByResetToken(token) {
    return db.prepare(
      'SELECT * FROM users WHERE reset_token = :token LIMIT 1'
    ).get({ token });
  },

  /**
   * Create a new user. Hashes the password before storing.
   * Returns the safe public user object (no password_hash).
   */
  async create({ fullName, email, password }) {
    const id           = genId();
    const passwordHash = await bcrypt.hash(password, 12);
    const ts           = now();

    db.prepare(`
      INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at)
      VALUES (:id, :fullName, :email, :passwordHash, :createdAt, :updatedAt)
    `).run({ id, fullName, email, passwordHash, createdAt: ts, updatedAt: ts });

    return { id, fullName, email, createdAt: ts };
  },

  /**
   * Verify a plain password against the stored hash.
   */
  async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  },

  /**
   * Save a password-reset token with a 1-hour expiry.
   */
  setResetToken(userId, token) {
    const expiry = new Date(Date.now() + 3600_000).toISOString(); // 1 hour
    db.prepare(`
      UPDATE users
      SET reset_token = :token, reset_token_expiry = :expiry, updated_at = :updatedAt
      WHERE id = :userId
    `).run({ token, expiry, updatedAt: now(), userId });
  },

  /**
   * Set a new password (hashed) and clear the reset token.
   */
  async resetPassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    db.prepare(`
      UPDATE users
      SET password_hash = :passwordHash,
          reset_token = NULL,
          reset_token_expiry = NULL,
          updated_at = :updatedAt
      WHERE id = :userId
    `).run({ passwordHash, updatedAt: now(), userId });
  },
};

module.exports = User;
