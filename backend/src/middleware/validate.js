// src/middleware/validate.js
// ─────────────────────────────────────────────────────────────────────────────
// Validation rules using express-validator.
//
// Pattern:
//   1. Define a chain of check() rules
//   2. Call handleValidation as the last middleware — it reads the results
//      and returns a 422 with { success: false, errors: [...] } if invalid
//
// Usage in routes:
//   router.post('/', validateCreate, itemController.create);
// ─────────────────────────────────────────────────────────────────────────────

const { body, query, param, validationResult } = require('express-validator');
const { fail } = require('../utils/apiResponse');

// ── Run validation and abort if errors found ──────────────────────────────────
function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map(e => ({
    field:   e.path,
    message: e.msg,
  }));

  return res.status(422).json(fail('Validation failed', errors));
}

// ── Rules: POST /api/items ────────────────────────────────────────────────────
const validateCreate = [
  body('name')
    .trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 200 }).withMessage('name must be under 200 characters'),

  body('quantity')
    .notEmpty().withMessage('quantity is required')
    .isInt({ min: 0 }).withMessage('quantity must be a whole number >= 0'),

  body('minLevel')
    .notEmpty().withMessage('minLevel is required')
    .isInt({ min: 0 }).withMessage('minLevel must be a whole number >= 0'),

  body('partNumber')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('partNumber must be under 100 characters'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('category must be under 100 characters'),

  body('reorderQty')
    .optional()
    .isInt({ min: 1 }).withMessage('reorderQty must be a whole number >= 1'),

  body('unit')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('unit must be under 50 characters'),

  body('unitCost')
    .optional()
    .isFloat({ min: 0 }).withMessage('unitCost must be a positive number'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('location must be under 200 characters'),

  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('supplier must be under 200 characters'),

  handleValidation,
];

// ── Rules: PUT /api/items/:id ─────────────────────────────────────────────────
// Same as create but ALL fields are optional (partial update / PATCH semantics)
const validateUpdate = [
  param('id')
    .notEmpty().withMessage('id param is required'),

  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('name cannot be empty if provided')
    .isLength({ max: 200 }).withMessage('name must be under 200 characters'),

  body('quantity')
    .optional()
    .isInt({ min: 0 }).withMessage('quantity must be a whole number >= 0'),

  body('minLevel')
    .optional()
    .isInt({ min: 0 }).withMessage('minLevel must be a whole number >= 0'),

  body('reorderQty')
    .optional()
    .isInt({ min: 1 }).withMessage('reorderQty must be a whole number >= 1'),

  body('unitCost')
    .optional()
    .isFloat({ min: 0 }).withMessage('unitCost must be a positive number'),

  body('partNumber')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('partNumber must be under 100 characters'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('category must be under 100 characters'),

  body('unit')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('unit must be under 50 characters'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('location must be under 200 characters'),

  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('supplier must be under 200 characters'),

  handleValidation,
];

// ── Rules: GET /api/items?search=&status=&sortBy=&order= ─────────────────────
const validateQuery = [
  query('status')
    .optional()
    .isIn(['in_stock', 'low_stock', 'out_of_stock'])
    .withMessage('status must be: in_stock | low_stock | out_of_stock'),

  query('sortBy')
    .optional()
    .isIn(['name', 'quantity', 'category', 'updatedAt', 'unitCost', 'status'])
    .withMessage('sortBy must be: name | quantity | category | updatedAt | unitCost | status'),

  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('order must be: asc | desc'),

  handleValidation,
];

module.exports = { validateCreate, validateUpdate, validateQuery };
