// src/controllers/itemController.js
// ─────────────────────────────────────────────────────────────────────────────
// HTTP layer only — reads req, calls the service, writes res.
// NO business logic, NO SQL here.
//
// Every controller function follows this pattern:
//   1. Extract what's needed from req (params, body, query)
//   2. Call the service
//   3. Return the standard response shape via apiResponse helpers
//   4. Pass any thrown errors to next(err) → errorHandler middleware
// ─────────────────────────────────────────────────────────────────────────────

const ItemService = require('../services/itemService');
const { ok }      = require('../utils/apiResponse');

// ── GET /api/items ────────────────────────────────────────────────────────────
// Supports: ?search= ?status= ?category= ?sortBy= ?order=
const getAll = (req, res, next) => {
  try {
    const result = ItemService.getAll(req.query);
    return res.status(200).json(ok(
      `${result.count} item(s) found`,
      result.items,
      { count: result.count, categories: result.categories }
    ));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/items/summary ────────────────────────────────────────────────────
// Dashboard stats: totals, status counts, inventory value
const getSummary = (req, res, next) => {
  try {
    const summary = ItemService.getSummary();
    return res.status(200).json(ok('Summary fetched', {
      total:       summary.total,
      inStock:     summary.in_stock,
      lowStock:    summary.low_stock,
      outOfStock:  summary.out_of_stock,
      totalValue:  summary.total_value || 0,
    }));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/items/low-stock ──────────────────────────────────────────────────
// Returns only items where quantity < minLevel
const getLowStock = (req, res, next) => {
  try {
    const result = ItemService.getLowStock();
    return res.status(200).json(ok(
      `${result.count} item(s) need attention`,
      result.items,
      { count: result.count }
    ));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/items/:id ────────────────────────────────────────────────────────
const getById = (req, res, next) => {
  try {
    const item = ItemService.getById(req.params.id);
    return res.status(200).json(ok('Item fetched', item));
  } catch (err) {
    next(err);
  }
};

// ── POST /api/items ───────────────────────────────────────────────────────────
const create = (req, res, next) => {
  try {
    const item = ItemService.create(req.body);
    return res.status(201).json(ok('Item created successfully', item));
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/items/:id ────────────────────────────────────────────────────────
const update = (req, res, next) => {
  try {
    const item = ItemService.update(req.params.id, req.body);
    return res.status(200).json(ok('Item updated successfully', item));
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/items/:id ─────────────────────────────────────────────────────
const remove = (req, res, next) => {
  try {
    const deleted = ItemService.remove(req.params.id);
    return res.status(200).json(ok(`"${deleted.name}" deleted successfully`, null));
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getSummary, getLowStock, getById, create, update, remove };
