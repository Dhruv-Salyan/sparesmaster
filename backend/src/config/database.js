// src/config/database.js
// ─────────────────────────────────────────────────────────────────────────────
// SQLite via node-sqlite3-wasm — pure JavaScript, no C++ compiler needed.
// Works on Node v24, Windows, Mac, Linux with zero build steps.
//
// API compatibility layer:
//   Our models use better-sqlite3 style: { key: value }
//   node-sqlite3-wasm needs:             { ':key': value }
//   The prefixParams() helper bridges the gap automatically.
// ─────────────────────────────────────────────────────────────────────────────

const { Database } = require('node-sqlite3-wasm');
const path         = require('path');
const fs           = require('fs');
const logger       = require('../utils/logger');

// Resolve DB path from .env (default: ./db/inventory.db)
const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH || './db/inventory.db');

// Ensure the db/ directory exists before opening
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Open / create the database file
const rawDb = new Database(DB_PATH);
logger.info(`Database connected: ${DB_PATH}`);

// ── Parameter converter ───────────────────────────────────────────────────────
// better-sqlite3 accepts plain objects: .all({ status: 'low_stock' })
// node-sqlite3-wasm requires colon-prefixed keys: .all({ ':status': 'low_stock' })
//
// This function converts one to the other so all existing model code is unchanged.

function prefixParams(params) {
  // Already an array of positional values — pass straight through
  if (Array.isArray(params)) return params;
  // No params at all
  if (!params || typeof params !== 'object') return [];
  // Named object: prefix every key with ':'
  const out = {};
  for (const [key, val] of Object.entries(params)) {
    out[key.startsWith(':') ? key : ':' + key] = val;
  }
  return out;
}

// ── db wrapper — drop-in replacement for better-sqlite3 ──────────────────────

const db = {
  prepare(sql) {
    return {
      // Return all matching rows as an array
      all(params) {
        return rawDb.all(sql, prefixParams(params));
      },
      // Return first matching row, or null
      get(params) {
        return rawDb.get(sql, prefixParams(params)) ?? null;
      },
      // Execute INSERT / UPDATE / DELETE — returns { changes }
      run(params) {
        const result = rawDb.run(sql, prefixParams(params));
        return { changes: result.changes };
      },
    };
  },

  // Run raw SQL (CREATE TABLE, etc.)
  exec(sql) { rawDb.exec(sql); },

  // PRAGMA — node-sqlite3-wasm handles most pragmas via exec
  pragma(statement) {
    try { rawDb.exec(`PRAGMA ${statement};`); } catch { /* ignore unsupported */ }
  },

  close() { rawDb.close(); },
};

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id           TEXT    PRIMARY KEY,
    name         TEXT    NOT NULL,
    part_number  TEXT    NOT NULL DEFAULT '',
    category     TEXT    NOT NULL DEFAULT 'General',
    quantity     INTEGER NOT NULL DEFAULT 0,
    min_level    INTEGER NOT NULL DEFAULT 0,
    reorder_qty  INTEGER NOT NULL DEFAULT 10,
    unit         TEXT    NOT NULL DEFAULT 'pcs',
    unit_cost    REAL    NOT NULL DEFAULT 0,
    location     TEXT    NOT NULL DEFAULT '',
    supplier     TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'in_stock',
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_items_status   ON items(status);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_items_name     ON items(name);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS item_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    TEXT    NOT NULL,
    old_qty    INTEGER NOT NULL,
    new_qty    INTEGER NOT NULL,
    change     INTEGER NOT NULL,
    changed_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_history_item ON item_history(item_id);
  CREATE INDEX IF NOT EXISTS idx_history_date ON item_history(changed_at);
`);

logger.info('Database schema verified');
module.exports = db;
