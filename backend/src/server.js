// src/server.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point — loads .env, initialises the DB, then starts listening.
// ─────────────────────────────────────────────────────────────────────────────

// Load environment variables FIRST (before any other require)
require('dotenv').config();

const app    = require('./app');
const logger = require('./utils/logger');

// This require triggers database.js which opens the SQLite file and
// runs CREATE TABLE IF NOT EXISTS — so the DB is ready before any request hits
const db = require('./config/database');
const path = require('path');

// Auto-seed if database is empty
try {
  const row = db.prepare('SELECT COUNT(*) as count FROM items').get();
  if (row.count === 0) {
    logger.info('Database empty — running seed...');
    require('../scripts/seed');
    logger.info('Seed complete');
  }
} catch (e) {
  logger.error('Seed check failed', { error: e.message });
}

const PORT = parseInt(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  logger.info('');
  logger.info('  ⚙  Optimum Inventory Control — Backend API v2');
  logger.info(`  ✅  Server        : http://localhost:${PORT}`);
  logger.info(`  📦  Items API     : http://localhost:${PORT}/api/items`);
  logger.info(`  🩺  Health check  : http://localhost:${PORT}/api/health`);
  logger.info(`  📊  Low stock     : http://localhost:${PORT}/api/items/low-stock`);
  logger.info(`  🌐  Frontend      : http://localhost:${PORT}`);
  logger.info(`  🗄  Environment   : ${process.env.NODE_ENV || 'development'}`);
  logger.info('');
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Allows in-flight requests to complete before the process exits.
// Important in production (Railway, Docker, PM2).
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 s if server.close() hangs
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch unhandled promise rejections so the server doesn't silently crash
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});
