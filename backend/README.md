# Optimum Inventory Control — Backend API v2

Production-ready REST API for managing machine spare parts inventory.  
**Stack:** Node.js · Express · SQLite (better-sqlite3) · Winston

---

## Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # SQLite connection + schema creation
│   ├── controllers/
│   │   └── itemController.js    # HTTP layer — reads req, writes res
│   ├── middleware/
│   │   ├── errorHandler.js      # Global error handler (last middleware)
│   │   ├── rateLimiter.js       # express-rate-limit
│   │   └── validate.js          # express-validator rules
│   ├── models/
│   │   └── Item.js              # All SQL queries for the items table
│   ├── routes/
│   │   └── items.js             # Route → middleware → controller wiring
│   ├── services/
│   │   └── itemService.js       # Business logic between controller & model
│   ├── utils/
│   │   ├── apiResponse.js       # ok() / fail() response builders
│   │   └── logger.js            # Winston logger (console + file)
│   ├── app.js                   # Express app setup
│   └── server.js                # Entry point — starts server
├── db/
│   └── inventory.db             # SQLite file (auto-created, gitignored)
├── logs/
│   ├── combined.log             # All logs (gitignored)
│   └── error.log                # Error-only log (gitignored)
├── scripts/
│   ├── seed.js                  # Migrate data.json → SQLite
│   └── resetDb.js               # Drop & recreate table (dev only)
├── .env                         # Local config (gitignored)
├── .env.example                 # Template to commit to git
├── .gitignore
└── package.json
```

---

## Setup & Run

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env if needed — defaults work for local development
```

### 3. Seed the database (first time only)
```bash
# Imports your existing data.json into SQLite
npm run seed
```

### 4. Start the server

**Development** (auto-restarts on file changes):
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server starts at: `http://localhost:3000`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `development` or `production` |
| `DB_PATH` | `./db/inventory.db` | Path to SQLite file |
| `CORS_ORIGIN` | `*` | Allowed origin(s) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `LOG_LEVEL` | `info` | Winston log level |

---

## Database Schema

```sql
CREATE TABLE items (
  id           TEXT    PRIMARY KEY,            -- 'itm_' + random suffix
  name         TEXT    NOT NULL,
  part_number  TEXT    NOT NULL DEFAULT '',
  category     TEXT    NOT NULL DEFAULT 'General',
  quantity     INTEGER NOT NULL DEFAULT 0,
  min_level    INTEGER NOT NULL DEFAULT 0,
  reorder_qty  INTEGER NOT NULL DEFAULT 10,
  unit         TEXT    NOT NULL DEFAULT 'pcs',
  unit_cost    REAL    NOT NULL DEFAULT 0,
  location     TEXT    NOT NULL DEFAULT '',
  supplier     TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'in_stock'
               CHECK(status IN ('in_stock', 'low_stock', 'out_of_stock')),
  created_at   TEXT    NOT NULL,               -- ISO-8601 timestamp
  updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_items_status   ON items(status);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_name     ON items(name);
```

**Status logic** (computed automatically on every create/update):
- `out_of_stock` — quantity === 0
- `low_stock`    — quantity < minLevel
- `in_stock`     — quantity >= minLevel

---

## API Reference

All responses follow the standard shape:
```json
{
  "success": true,
  "message": "Human-readable result",
  "data": {}
}
```

### Base URL
```
http://localhost:3000/api
```

---

### Health Check
```
GET /api/health
```
```json
{
  "success": true,
  "message": "API is running",
  "data": { "environment": "development", "timestamp": "2026-04-25T..." }
}
```

---

### Items

#### GET /api/items
List all items. Supports search, filter, and sort.

**Query parameters:**

| Param | Type | Example | Description |
|---|---|---|---|
| `search` | string | `bearing` | Searches name, partNumber, location, supplier |
| `status` | string | `low_stock` | Filter by status |
| `category` | string | `Bearings` | Filter by category (exact match) |
| `sortBy` | string | `quantity` | Sort column: `name` \| `quantity` \| `category` \| `updatedAt` \| `unitCost` \| `status` |
| `order` | string | `asc` | `asc` or `desc` |

**Example:**
```
GET /api/items?search=bearing&sortBy=quantity&order=asc
```
```json
{
  "success": true,
  "message": "2 item(s) found",
  "data": [...],
  "count": 2,
  "categories": ["Bearings", "Belts", "Seals"]
}
```

---

#### GET /api/items/summary
Dashboard statistics.
```json
{
  "success": true,
  "message": "Summary fetched",
  "data": {
    "total": 8,
    "inStock": 4,
    "lowStock": 3,
    "outOfStock": 1,
    "totalValue": 24850.00
  }
}
```

---

#### GET /api/items/low-stock
Items where `quantity < minLevel`, sorted by urgency.
```json
{
  "success": true,
  "message": "4 item(s) need attention",
  "data": [...],
  "count": 4
}
```

---

#### GET /api/items/:id
Single item by ID.
```json
{
  "success": true,
  "message": "Item fetched",
  "data": {
    "id": "itm_001",
    "name": "Deep Groove Ball Bearing",
    "partNumber": "SKF-6205",
    "category": "Bearings",
    "quantity": 3,
    "minLevel": 5,
    "reorderQty": 20,
    "unit": "pcs",
    "unitCost": 250,
    "location": "Rack A-12",
    "supplier": "SKF India",
    "status": "low_stock",
    "createdAt": "2026-04-25T10:00:00.000Z",
    "updatedAt": "2026-04-25T10:00:00.000Z"
  }
}
```

---

#### POST /api/items
Create a new item.

**Required fields:** `name`, `quantity`, `minLevel`  
**Optional fields:** `partNumber`, `category`, `reorderQty`, `unit`, `unitCost`, `location`, `supplier`

```json
// Request body
{
  "name": "Deep Groove Ball Bearing",
  "partNumber": "SKF-6205",
  "category": "Bearings",
  "quantity": 3,
  "minLevel": 5,
  "reorderQty": 20,
  "unit": "pcs",
  "unitCost": 250,
  "location": "Rack A-12",
  "supplier": "SKF India"
}
```
Returns `201 Created` with the new item.

---

#### PUT /api/items/:id
Partial update — send only the fields you want to change.  
Status is **always recomputed** from the final quantity + minLevel.

```json
// Update only the quantity
{ "quantity": 15 }
```
Returns `200 OK` with the updated item.

---

#### DELETE /api/items/:id
```json
{
  "success": true,
  "message": "\"Deep Groove Ball Bearing\" deleted successfully",
  "data": null
}
```

---

### Error Responses

**Validation error (422):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "quantity", "message": "quantity must be a whole number >= 0" }
  ]
}
```

**Not found (404):**
```json
{
  "success": false,
  "message": "Item with id \"itm_xyz\" not found"
}
```

**Rate limit exceeded (429):**
```json
{
  "success": false,
  "message": "Too many requests — please slow down and try again later"
}
```

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start production server |
| `npm run dev` | Start dev server with auto-restart (nodemon) |
| `npm run seed` | Import data.json into SQLite (run once) |
| `npm run db:reset` | Drop + recreate table (dev only, never production) |
