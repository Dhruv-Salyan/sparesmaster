// src/models/Item.js
// ─────────────────────────────────────────────────────────────────────────────
// Data Access Layer — all SQL for the `items` table lives here.
// Controllers never write SQL; they call these methods.
//
// Column naming:
//   SQLite columns use snake_case  (part_number, min_level, unit_cost)
//   JavaScript objects use camelCase (partNumber, minLevel, unitCost)
//   toJS() converts from DB row → JS object on every read.
// ─────────────────────────────────────────────────────────────────────────────

const db = require('../config/database');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a DB row (snake_case) to the API response shape (camelCase). */
function toJS(row) {
  if (!row) return null;
  return {
    id:          row.id,
    name:        row.name,
    partNumber:  row.part_number,
    category:    row.category,
    quantity:    row.quantity,
    minLevel:    row.min_level,
    reorderQty:  row.reorder_qty,
    unit:        row.unit,
    unitCost:    row.unit_cost,
    location:    row.location,
    supplier:    row.supplier,
    status:      row.status,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

/** Compute status from quantity and minLevel (single source of truth). */
function computeStatus(quantity, minLevel) {
  if (quantity === 0)             return 'out_of_stock';
  if (quantity < minLevel)        return 'low_stock';
  return 'in_stock';
}

/** Generate a simple unique ID like 'itm_x7k2p9q1'. */
function generateId() {
  return 'itm_' + Math.random().toString(36).slice(2, 10);
}

/** Current UTC timestamp in ISO-8601 format. */
function now() {
  return new Date().toISOString();
}

// ── Model Methods ─────────────────────────────────────────────────────────────

const Item = {

  /**
   * Return all items, with optional filtering, searching, and sorting.
   *
   * @param {object} options
   * @param {string} [options.search]   - Substring match on name, part_number, location
   * @param {string} [options.status]   - 'in_stock' | 'low_stock' | 'out_of_stock'
   * @param {string} [options.category] - Exact category match
   * @param {string} [options.sortBy]   - Column to sort (name|quantity|category|updatedAt)
   * @param {string} [options.order]    - 'asc' | 'desc'
   * @returns {object[]} Array of camelCase item objects
   */
  findAll({ search, status, category, sortBy = 'name', order = 'asc' } = {}) {
    // ── Whitelist sortable columns to prevent SQL injection ────────────────
    const SORTABLE = {
      name:      'name',
      quantity:  'quantity',
      category:  'category',
      updatedAt: 'updated_at',
      unitCost:  'unit_cost',
      status:    'status',
    };
    const sortCol = SORTABLE[sortBy] || 'name';
    const sortDir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // ── Build WHERE clauses dynamically ───────────────────────────────────
    const conditions = [];
    const params     = {};

    if (search) {
      conditions.push(`(
        name        LIKE :search OR
        part_number LIKE :search OR
        location    LIKE :search OR
        supplier    LIKE :search
      )`);
      params.search = `%${search}%`;
    }

    if (status) {
      conditions.push('status = :status');
      params.status = status;
    }

    if (category) {
      conditions.push('category = :category');
      params.category = category;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql   = `SELECT * FROM items ${where} ORDER BY ${sortCol} ${sortDir}`;

    const rows = db.prepare(sql).all(params);
    return rows.map(toJS);
  },

  /**
   * Return a single item by its ID, or null if not found.
   * @param {string} id
   */
  findById(id) {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    return toJS(row);
  },

  /**
   * Return all items where quantity < min_level (low stock + out of stock).
   * Sorted by urgency: out_of_stock first, then by how far below min_level.
   */
  findLowStock() {
    const rows = db.prepare(`
      SELECT * FROM items
      WHERE  quantity < min_level
      ORDER  BY quantity ASC, min_level DESC
    `).all();
    return rows.map(toJS);
  },

  /**
   * Return unique category names (for populating filter dropdowns).
   */
  findCategories() {
    const rows = db.prepare(`
      SELECT DISTINCT category FROM items ORDER BY category ASC
    `).all();
    return rows.map(r => r.category);
  },

  /**
   * Insert a new item.
   * @param {object} data - Validated item fields (camelCase)
   * @returns {object}    - The created item
   */
  create(data) {
    const id     = generateId();
    const ts     = now();
    const status = computeStatus(data.quantity, data.minLevel);

    db.prepare(`
      INSERT INTO items (
        id, name, part_number, category,
        quantity, min_level, reorder_qty,
        unit, unit_cost, location, supplier,
        status, created_at, updated_at
      ) VALUES (
        :id, :name, :partNumber, :category,
        :quantity, :minLevel, :reorderQty,
        :unit, :unitCost, :location, :supplier,
        :status, :createdAt, :updatedAt
      )
    `).run({
      id,
      name:        data.name.trim(),
      partNumber:  (data.partNumber  || '').trim(),
      category:    (data.category    || 'General').trim(),
      quantity:    Number(data.quantity),
      minLevel:    Number(data.minLevel),
      reorderQty:  Number(data.reorderQty  ?? 10),
      unit:        (data.unit        || 'pcs').trim(),
      unitCost:    Number(data.unitCost     ?? 0),
      location:    (data.location    || '').trim(),
      supplier:    (data.supplier    || '').trim(),
      status,
      createdAt:   ts,
      updatedAt:   ts,
    });

    return this.findById(id);
  },

  /**
   * Partially update an item. Only provided fields are changed.
   * Status is always recomputed from the final quantity + minLevel.
   *
   * @param {string} id
   * @param {object} data - Fields to update (camelCase)
   * @returns {object|null}  - Updated item, or null if not found
   */
  update(id, data) {
    const existing = this.findById(id);
    if (!existing) return null;

    // Merge: use incoming value if provided, otherwise keep existing
    const merged = {
      name:       data.name       !== undefined ? data.name.trim()            : existing.name,
      partNumber: data.partNumber !== undefined ? data.partNumber.trim()       : existing.partNumber,
      category:   data.category   !== undefined ? data.category.trim()         : existing.category,
      quantity:   data.quantity   !== undefined ? Number(data.quantity)        : existing.quantity,
      minLevel:   data.minLevel   !== undefined ? Number(data.minLevel)        : existing.minLevel,
      reorderQty: data.reorderQty !== undefined ? Number(data.reorderQty)      : existing.reorderQty,
      unit:       data.unit       !== undefined ? data.unit.trim()             : existing.unit,
      unitCost:   data.unitCost   !== undefined ? Number(data.unitCost)        : existing.unitCost,
      location:   data.location   !== undefined ? data.location.trim()         : existing.location,
      supplier:   data.supplier   !== undefined ? data.supplier.trim()         : existing.supplier,
    };

    merged.status    = computeStatus(merged.quantity, merged.minLevel);
    merged.updatedAt = now();

    db.prepare(`
      UPDATE items SET
        name        = :name,
        part_number = :partNumber,
        category    = :category,
        quantity    = :quantity,
        min_level   = :minLevel,
        reorder_qty = :reorderQty,
        unit        = :unit,
        unit_cost   = :unitCost,
        location    = :location,
        supplier    = :supplier,
        status      = :status,
        updated_at  = :updatedAt
      WHERE id = :id
    `).run({ ...merged, id });

    // Record history entry whenever quantity changes (for demand estimation)
    if (merged.quantity !== existing.quantity) {
      db.prepare(`
        INSERT INTO item_history (item_id, old_qty, new_qty, change, changed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, existing.quantity, merged.quantity,
             merged.quantity - existing.quantity, merged.updatedAt);
    }

    return this.findById(id);
  },

  /**
   * Return quantity change history for a specific item (used by demand engine).
   */
  getHistory(itemId, limit = 30) {
    return db.prepare(`
      SELECT * FROM item_history
      WHERE  item_id = ?
      ORDER  BY changed_at DESC
      LIMIT  ?
    `).all(itemId, limit);
  },

  /**
   * Delete an item by ID.
   * @param {string} id
   * @returns {boolean} true if a row was deleted, false if ID not found
   */
  delete(id) {
    const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Return summary counts used by the dashboard.
   */
  getSummary() {
    return db.prepare(`
      SELECT
        COUNT(*)                                      AS total,
        SUM(CASE WHEN status = 'in_stock'     THEN 1 ELSE 0 END) AS in_stock,
        SUM(CASE WHEN status = 'low_stock'    THEN 1 ELSE 0 END) AS low_stock,
        SUM(CASE WHEN status = 'out_of_stock' THEN 1 ELSE 0 END) AS out_of_stock,
        SUM(quantity * unit_cost)                     AS total_value
      FROM items
    `).get();
  },
};

module.exports = Item;
