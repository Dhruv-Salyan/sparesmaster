# SparesMaster — Frontend

Modern, responsive inventory management dashboard.  
**Stack:** Vanilla HTML · Tailwind CSS CDN · TypeScript (compiled to JS)

---

## Folder Structure

```
frontend/
├── index.html          # Main SPA shell — all 4 pages in one file
├── tsconfig.json       # TypeScript compiler config
├── css/
│   └── styles.css      # Design tokens, layout, components, animations
└── js/
    ├── app.ts          # TypeScript source (edit this)
    └── app.js          # Compiled output (served in browser)
```

---

## Pages

| Page | Route (nav) | Description |
|---|---|---|
| Dashboard | `dashboard` | Stats cards, alerts, category chart, recent activity |
| Inventory | `inventory` | Full table — search, filter, sort, edit, delete |
| Add Item  | `add-item`  | Multi-section form to register a new spare part |
| Reports   | `reports`   | Stock health bar, category breakdown, reorder list |

---

## Features

- **4 stat cards** — Total Parts, In Stock, Low Stock, Out of Stock (animated count-up)
- **Inventory value banner** — total ₹ value at a glance
- **Stock alert panel** — parts below minimum, sorted by urgency
- **Category bar chart** — stock distribution by category
- **Recent activity table** — 6 most recently updated parts
- **Full inventory table** — search (name/part no./location/supplier), filter by category + status, sort by any column
- **Add item form** — 3-section layout with validation hints
- **Edit modal** — pre-filled, partial update, auto-close on save
- **Delete** with confirmation dialog
- **Toast notifications** — success / error / warning / info
- **Loading skeletons** — shown while API loads
- **Empty states** — friendly messages when no data
- **API status indicator** — live dot in sidebar (green/red)
- **Graceful offline mode** — works without backend, shows helpful message

---

## Design System

| Token | Value |
|---|---|
| Font Display | Syne (headings, numbers) |
| Font Body | Outfit (UI text) |
| Font Mono | JetBrains Mono (data, labels) |
| Primary Accent | `#f59e0b` (amber) |
| Background Base | `#0a0e1a` (deep navy) |
| Success | `#10b981` (emerald) |
| Warning | `#f59e0b` (amber) |
| Danger | `#ef4444` (red) |

---

## Setup

### Option A — Serve statically (simplest)
The Express backend already serves the frontend:
```bash
# From backend folder:
npm run dev
# Visit: http://localhost:3000
```

### Option B — Open directly (no server)
1. Open `index.html` in a browser
2. The app will show "API Offline" since the backend isn't running
3. Start the backend to connect

### Option C — Compile TypeScript (optional)
If you edit `js/app.ts`:
```bash
cd frontend
npx tsc
# This compiles app.ts → app.js automatically
```
For watch mode during development:
```bash
npx tsc --watch
```

---

## Connecting to Backend

The API base URL is set at the top of `js/app.js`:
```js
const API_BASE = 'http://localhost:3000/api';
```

Change this if your backend runs on a different port or domain.

---

## API Endpoints Used

| Method | Endpoint | Used for |
|---|---|---|
| GET | `/api/items` | Load full inventory + categories |
| GET | `/api/items/summary` | Dashboard stat cards |
| GET | `/api/items/low-stock` | Alert panel |
| POST | `/api/items` | Add item form |
| PUT | `/api/items/:id` | Edit modal |
| DELETE | `/api/items/:id` | Delete button |
