// src/routes/optimize.js
// ─────────────────────────────────────────────────────────────────────────────
//  All optimization endpoints mounted at /api/optimize
//
//  GET /api/optimize           → full intelligence report (all 6 features)
//  GET /api/optimize/reorder   → feature 1+2: reorder suggestions + quantities
//  GET /api/optimize/ranking   → feature 4: criticality ranking
//  GET /api/optimize/demand    → feature 5: demand estimation
//  GET /api/optimize/warnings  → feature 6: dashboard warnings
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/optimizationController');

router.get('/',          ctrl.getFullReport);
router.get('/reorder',   ctrl.getReorderSuggestions);
router.get('/ranking',   ctrl.getCriticalityRanking);
router.get('/demand',    ctrl.getDemandEstimates);
router.get('/warnings',  ctrl.getWarnings);

module.exports = router;
