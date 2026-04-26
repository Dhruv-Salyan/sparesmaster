// src/controllers/optimizationController.js
// ─────────────────────────────────────────────────────────────────────────────
//  HTTP layer for optimization endpoints.
//  Reads items from DB, runs the engine, returns results.
//  No business logic here — all logic is in optimizationEngine.js
// ─────────────────────────────────────────────────────────────────────────────

const Item   = require('../models/Item');
const engine = require('../services/optimizationEngine');
const { ok } = require('../utils/apiResponse');

// ── GET /api/optimize  ────────────────────────────────────────────────────────
// Full intelligence report: all 6 features in one response
const getFullReport = (req, res, next) => {
  try {
    const items  = Item.findAll();
    const report = engine.runOptimization(items);
    return res.status(200).json(ok('Optimization report generated', report));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/optimize/reorder  ────────────────────────────────────────────────
// Feature 1 + 2: Auto reorder suggestions with computed quantities
const getReorderSuggestions = (req, res, next) => {
  try {
    const items       = Item.findAll();
    const suggestions = engine.getReorderSuggestions(items);
    return res.status(200).json(ok(
      `${suggestions.length} reorder suggestion(s)`,
      suggestions,
      { count: suggestions.length }
    ));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/optimize/ranking  ────────────────────────────────────────────────
// Feature 4: Criticality ranking (most critical items first)
const getCriticalityRanking = (req, res, next) => {
  try {
    const items   = Item.findAll();
    const ranking = engine.rankByCriticality(items);
    return res.status(200).json(ok(
      `${ranking.length} items ranked by criticality`,
      ranking,
      { count: ranking.length }
    ));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/optimize/demand  ─────────────────────────────────────────────────
// Feature 5: Demand estimation / days to stockout
const getDemandEstimates = (req, res, next) => {
  try {
    const items     = Item.findAll();
    const estimates = engine.estimateDemand(items);
    return res.status(200).json(ok(
      `Demand estimated for ${estimates.length} items`,
      estimates,
      { count: estimates.length }
    ));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/optimize/warnings  ───────────────────────────────────────────────
// Feature 6: Dashboard warnings (critical / warning / info)
const getWarnings = (req, res, next) => {
  try {
    const items    = Item.findAll();
    const warnings = engine.getDashboardWarnings(items);
    return res.status(200).json(ok(
      `${warnings.counts.total} warning(s) generated`,
      warnings
    ));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFullReport,
  getReorderSuggestions,
  getCriticalityRanking,
  getDemandEstimates,
  getWarnings,
};
