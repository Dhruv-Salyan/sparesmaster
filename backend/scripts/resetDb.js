// scripts/resetDb.js
// Drops and recreates the database, then re-seeds it.
// Run:  node scripts/resetDb.js

require('dotenv').config();

const path = require('path');
const fs   = require('fs');

const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH || './db/inventory.db');

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('🗑  Deleted existing database');
}

// Recreate schema by requiring database.js
require('../src/config/database');
console.log('✅  Fresh database created');

// Re-seed
require('./seed');
