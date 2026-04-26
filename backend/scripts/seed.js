// scripts/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Loads sample data from data.json into the SQLite database.
// Safe to run multiple times — uses INSERT OR IGNORE.
//
// Run:  node scripts/seed.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();

const path = require('path');
const fs   = require('fs');

// Bootstrap DB (creates tables automatically)
const db = require('../src/config/database');

const DATA_FILE = path.resolve(__dirname, 'data.json');

if (!fs.existsSync(DATA_FILE)) {
  console.error('❌  data.json not found at: ' + DATA_FILE);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const now  = new Date().toISOString();

let inserted = 0;
let skipped  = 0;

data.forEach(d => {
  const status =
    d.quantity === 0         ? 'out_of_stock' :
    d.quantity < d.minLevel  ? 'low_stock'    : 'in_stock';

  // Check if already exists
  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get([d.id]);
  if (existing) { skipped++; return; }

  db.prepare(`
    INSERT INTO items
      (id, name, part_number, category, quantity, min_level, reorder_qty,
       unit, unit_cost, location, supplier, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    d.id,
    d.name,
    d.partNumber   || '',
    d.category     || 'General',
    Number(d.quantity),
    Number(d.minLevel),
    Number(d.reorderQty  || 10),
    d.unit         || 'pcs',
    Number(d.unitCost    || 0),
    d.location     || '',
    d.supplier     || '',
    status,
    d.createdAt    || now,
    d.lastUpdated  || now,
  ]);
  inserted++;
});

const total = db.prepare('SELECT COUNT(*) as c FROM items').get([]);
console.log(`✅  Seed complete — inserted: ${inserted}, skipped: ${skipped}, total in DB: ${total.c}`);
