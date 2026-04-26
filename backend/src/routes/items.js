// src/routes/items.js
// ─────────────────────────────────────────────────────────────────────────────
// Route definitions for /api/items
//
// Route table:
//   GET    /api/items               → getAll     (list, search, filter, sort)
//   GET    /api/items/summary       → getSummary (dashboard stats)
//   GET    /api/items/low-stock     → getLowStock (items needing reorder)
//   GET    /api/items/:id           → getById
//   POST   /api/items               → create
//   PUT    /api/items/:id           → update (partial)
//   DELETE /api/items/:id           → remove
//
// Note: /summary and /low-stock MUST be defined before /:id — otherwise
//       Express will try to match "summary" as an ID.
// ─────────────────────────────────────────────────────────────────────────────

const express     = require('express');
const router      = express.Router();
const ctrl        = require('../controllers/itemController');
const { validateCreate, validateUpdate, validateQuery } = require('../middleware/validate');

// Static routes first (before /:id)
router.get('/summary',   ctrl.getSummary);
router.get('/low-stock', ctrl.getLowStock);

// CRUD
router.get('/',    validateQuery,  ctrl.getAll);
router.get('/:id',                 ctrl.getById);
router.post('/',   validateCreate, ctrl.create);
router.put('/:id', validateUpdate, ctrl.update);
router.delete('/:id',              ctrl.remove);

module.exports = router;
