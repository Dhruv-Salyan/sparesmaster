// src/app.js
// ─────────────────────────────────────────────────────────────────────────────
// Express application factory.
// Separated from server.js so the app can be imported in tests without
// actually starting a listening server.
// ─────────────────────────────────────────────────────────────────────────────

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const path         = require('path');

const itemRoutes   = require('./routes/items');
const optimizeRoutes = require('./routes/optimize');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter  = require('./middleware/rateLimiter');
const logger       = require('./utils/logger');
const { ok, fail } = require('./utils/apiResponse');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
// CSP is disabled so the frontend can load Tailwind CDN and run inline scripts.
// In a production deployment you would configure a proper CSP instead.
app.use(helmet({
  contentSecurityPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));

// ── HTTP request logging via morgan → Winston ─────────────────────────────────
// In production, only log errors; in development log every request
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Rate limiter (applies to all API routes) ──────────────────────────────────
app.use('/api', rateLimiter);

// ── Serve frontend as static files ────────────────────────────────────────────
// Points to the sibling frontend/ directory.
// Change this path if your folder structure differs.
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/items',    itemRoutes);
app.use('/api/optimize', optimizeRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json(ok('API is running', {
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
  }));
});

// ── 404 — unknown API routes ──────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json(fail(`Route ${req.method} ${req.originalUrl} not found`));
});

// ── SPA fallback — serve index.html for all non-API routes ───────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ── Global error handler (MUST be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
