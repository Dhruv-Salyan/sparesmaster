// src/services/itemService.js
// ─────────────────────────────────────────────────────────────────────────────
// Service layer — sits between the controller and the model.
//
// Responsibility split:
//   Controller → HTTP concerns (req, res, status codes)
//   Service    → Business logic (what makes sense for the domain)
//   Model      → Data access (SQL queries)
//
// Keeping business logic here means if you ever expose a CLI or a job queue,
// you can reuse these functions without touching controllers.
// ─────────────────────────────────────────────────────────────────────────────

const Item = require('../models/Item');

const ItemService = {

  /**
   * Get all items with optional filters, search, and sort.
   * Also returns a count and the available categories (for dropdowns).
   */
  getAll(query) {
    const { search, status, category, sortBy, order } = query;

    // Validate that status filter is a known value (ignore unknown values silently)
    const VALID_STATUSES = ['in_stock', 'low_stock', 'out_of_stock'];
    const safeStatus = VALID_STATUSES.includes(status) ? status : undefined;

    const items      = Item.findAll({ search, status: safeStatus, category, sortBy, order });
    const categories = Item.findCategories();

    return {
      count:      items.length,
      categories,
      items,
    };
  },

  /**
   * Get a single item by ID. Throws a 404-style error if not found.
   */
  getById(id) {
    const item = Item.findById(id);
    if (!item) {
      const err  = new Error(`Item with id "${id}" not found`);
      err.status = 404;
      throw err;
    }
    return item;
  },

  /**
   * Get all items below their minimum stock level.
   * These are items that need attention or reordering.
   */
  getLowStock() {
    const items = Item.findLowStock();
    return {
      count: items.length,
      items,
    };
  },

  /**
   * Get dashboard summary stats (total, in/low/out counts, total value).
   */
  getSummary() {
    return Item.getSummary();
  },

  /**
   * Create a new item after confirming name uniqueness within category.
   * Returns the created item.
   */
  create(data) {
    return Item.create(data);
  },

  /**
   * Update an existing item. Throws 404 if not found.
   */
  update(id, data) {
    // Verify the item exists first (model returns null if not found)
    const existing = Item.findById(id);
    if (!existing) {
      const err  = new Error(`Item with id "${id}" not found`);
      err.status = 404;
      throw err;
    }
    return Item.update(id, data);
  },

  /**
   * Delete an item by ID. Throws 404 if not found.
   * Returns the item data before deletion (useful for the response message).
   */
  remove(id) {
    const existing = Item.findById(id);
    if (!existing) {
      const err  = new Error(`Item with id "${id}" not found`);
      err.status = 404;
      throw err;
    }
    Item.delete(id);
    return existing; // return what was deleted
  },
};

module.exports = ItemService;
