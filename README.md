<div align="center">

# ⚙️ SparesMaster

### Optimum Inventory Control for Machine Spare Parts

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?logo=render&logoColor=white)](https://render.com)

**SparesMaster** is a full-stack web application built for industrial maintenance teams to track, manage, and optimize their machine spare parts inventory — with zero external database dependencies.

[🚀 Live Demo](#) · [📖 API Docs](#api-reference) · [🐛 Report a Bug](../../issues) · [💡 Request Feature](../../issues)

</div>

---

## 📸 Screenshots

> **Tip for recruiters / contributors:** Clone the repo, seed the DB, and open `localhost:3000` to see it live.

| Dashboard | Inventory | Optimize |
|-----------|-----------|----------|
| ![Dashboard showing stat cards, stock alerts and category chart](docs/screenshots/dashboard.png) | ![Inventory table with search, filter and sort](docs/screenshots/inventory.png) | ![Optimization page with reorder suggestions and criticality ranking](docs/screenshots/optimize.png) |

> _Screenshots folder: `docs/screenshots/` — add your own after first run._

---

## ✨ Features

### 📊 Dashboard
- Live stat cards — Total Parts, In Stock, Low Stock, Out of Stock
- Total inventory value in ₹ (unit cost × quantity)
- Real-time stock alert feed for items below minimum level
- Category bar chart showing stock distribution
- Dynamic warnings banner (critical / warning severity)

### 📦 Inventory Management
- Full CRUD — create, view, edit, delete spare parts
- Search across part name, number, and storage location
- Filter by category and stock status
- Sortable columns (name, category, quantity, unit cost, status)
- Auto-computed status: `In Stock` / `Low Stock` / `Out of Stock`

### ⚡ Optimization Engine (6 Features)
1. **Auto Reorder Suggestions** — flags items below `minLevel` with suggested order qty
2. **Urgency Scoring** — Critical / High / Medium priority per item
3. **Status Classification** — automatic three-tier stock status
4. **Criticality Ranking** — weighted 0–100 score per part
5. **Demand Estimation** — daily/monthly usage rates & days-to-stockout
6. **Dashboard Warnings** — grouped alerts with one-click Edit actions

### 🛠️ Technical Highlights
- **Zero-config SQLite** — no PostgreSQL/MySQL setup needed, DB file created on first run
- **CSP-compliant frontend** — no inline event handlers, safe for strict security policies
- **REST API** with validation, rate limiting, structured error responses
- **Graceful shutdown** — handles SIGTERM/SIGINT for clean cloud deployments
- **Winston logging** — structured JSON logs in production
- **Helmet security headers** — production-hardened Express setup

---

## 🗂️ Project Structure

```
sparesmaster/
├── backend/                    # Express + SQLite API server
│   ├── src/
│   │   ├── app.js              # Express app factory (middleware, routes)
│   │   ├── server.js           # Entry point (env, DB init, listen)
│   │   ├── config/
│   │   │   └── database.js     # SQLite connection + schema migrations
│   │   ├── controllers/
│   │   │   ├── itemController.js
│   │   │   └── optimizationController.js
│   │   ├── services/
│   │   │   ├── itemService.js
│   │   │   └── optimizationEngine.js
│   │   ├── models/
│   │   │   └── Item.js
│   │   ├── routes/
│   │   │   ├── items.js
│   │   │   └── optimize.js
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   ├── rateLimiter.js
│   │   │   └── validate.js
│   │   └── utils/
│   │       ├── apiResponse.js
│   │       └── logger.js
│   ├── scripts/
│   │   ├── seed.js             # Populates DB with sample spare parts
│   │   ├── resetDb.js          # Wipes and recreates the database
│   │   └── data.json           # Seed data (20 sample parts)
│   ├── db/                     # Auto-created on first run (gitignored)
│   │   └── inventory.db
│   ├── package.json
│   └── .env                    # Your local config (gitignored)
│
├── frontend/                   # Vanilla HTML/CSS/JS (no framework)
│   ├── index.html              # Single-page app shell
│   ├── css/
│   │   └── styles.css          # Custom design system
│   └── js/
│       ├── app.js              # Compiled JS (ready to run)
│       └── app.ts              # TypeScript source
│
├── docs/
│   └── screenshots/            # Add screenshots here
│
├── .env.example                # ← Copy this to .env
├── .gitignore
├── package.json                # Root convenience scripts
├── render.yaml                 # One-click Render deployment
├── railway.toml                # Railway deployment config
└── README.md
```

---

## 🔧 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org) | v18 or higher | Runtime |
| [npm](https://npmjs.com) | v9+ | Package manager |
| Git | any | Version control |

No database server needed — SQLite runs embedded inside the app.

---

## 🚀 Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/sparesmaster.git
cd sparesmaster
```

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

```bash
# From the project root
cp .env.example backend/.env
```

Open `backend/.env` — the defaults work for local development, no changes needed.

### 4. (Optional) Seed with sample data

```bash
cd backend
npm run seed
```

This adds 20 realistic spare parts (bearings, seals, motors, etc.) so the dashboard has data to display immediately.

### 5. Start the server

```bash
npm start
# or for auto-reload during development:
npm run dev
```

### 6. Open in browser

```
http://localhost:3000
```

The API is available at `http://localhost:3000/api`.

---

## 📡 API Reference

Base URL: `http://localhost:3000/api`

### Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/items` | List all items (with categories) |
| `GET` | `/items/:id` | Get a single item |
| `GET` | `/items/summary` | Stat totals for dashboard cards |
| `GET` | `/items/low-stock` | Items below minimum level |
| `POST` | `/items` | Create a new item |
| `PUT` | `/items/:id` | Update an item |
| `DELETE` | `/items/:id` | Delete an item |

### Optimization

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/optimize` | Full optimization report |
| `GET` | `/optimize/warnings` | Dashboard warnings only |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |

#### Example: Create an item

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deep Groove Ball Bearing",
    "partNumber": "SKF-6205",
    "category": "Bearings",
    "quantity": 12,
    "minLevel": 5,
    "reorderQty": 10,
    "unit": "pcs",
    "unitCost": 450,
    "location": "Rack A-12",
    "supplier": "SKF India"
  }'
```

---

## ☁️ Deployment

### Option A — Render (Recommended for beginners)

Render gives you a free tier and handles everything automatically.

1. Push your code to GitHub (see [Git commands](#git-commands) below)
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your GitHub repository
4. Render reads `render.yaml` and sets everything up automatically
5. Your app will be live at `https://sparesmaster-api.onrender.com`

**Manual setup (without Blueprint):**

1. New → **Web Service** → connect your repo
2. Set **Root Directory** to `backend`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. Add a **Disk** (for the SQLite file):
   - Name: `sparesmaster-db`
   - Mount Path: `/var/data`
   - Size: 1 GB
6. Add environment variables:
   ```
   NODE_ENV=production
   DB_PATH=/var/data/inventory.db
   CORS_ORIGIN=*
   ```

> ⚠️ **Important:** Without a persistent disk, the SQLite file resets every time Render restarts your app. Always add the disk.

---

### Option B — Railway

Railway is developer-friendly with a generous free trial.

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select your repository
3. Railway auto-detects Node.js and uses `railway.toml`
4. Add environment variables in the Railway dashboard:
   ```
   NODE_ENV=production
   DB_PATH=/app/db/inventory.db
   CORS_ORIGIN=*
   ```
5. Your app is live — Railway gives you a `*.up.railway.app` URL

> ℹ️ Railway includes a persistent filesystem by default, so your SQLite data survives redeploys.

---

### Option C — Vercel (Frontend only)

Vercel is ideal if you want to host just the frontend separately and point it at a backend deployed elsewhere.

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. **Framework Preset:** Other
5. No build command needed (plain HTML/CSS/JS)
6. After deploy, update `API_BASE` in `frontend/js/app.js`:
   ```js
   const API_BASE = 'https://your-backend.onrender.com/api';
   ```
7. Redeploy

---

### Post-deployment checklist

- [ ] Visit `/api/health` — confirm `{"status":"ok"}`
- [ ] Open the app and check the dashboard loads
- [ ] Run the seed script once if you want sample data:
  ```bash
  # SSH into your server, or use Railway/Render shell
  node scripts/seed.js
  ```
- [ ] Set `CORS_ORIGIN` to your actual frontend URL for production

---

## 🔁 Git Commands

### First-time push to GitHub

```bash
# 1. Initialize git in the project root
git init

# 2. Stage everything
git add .

# 3. First commit
git commit -m "feat: initial release — SparesMaster v2.0"

# 4. Create a new repo on GitHub (github.com → New repository)
#    Then connect it:
git remote add origin https://github.com/YOUR_USERNAME/sparesmaster.git

# 5. Push
git branch -M main
git push -u origin main
```

### Subsequent updates

```bash
git add .
git commit -m "fix: your change description"
git push
```

### Useful commit message prefixes

| Prefix | Use for |
|--------|---------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | README / documentation |
| `style:` | CSS / UI changes |
| `refactor:` | Code cleanup |
| `chore:` | Config, package updates |

---

## 🧹 Useful Scripts

Run all commands from the `backend/` folder unless noted.

```bash
# Install dependencies
npm install

# Start production server
npm start

# Start dev server with auto-reload
npm run dev

# Seed database with 20 sample spare parts
npm run seed

# Wipe and recreate the database (useful during development)
npm run db:reset
```

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and commit: `git commit -m "feat: add your feature"`
4. Push to your fork: `git push origin feat/your-feature`
5. Open a Pull Request

Please keep PRs focused — one feature or fix per PR.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ☕ and Node.js

⭐ Star this repo if it helped you!
This is my first contribution

</div>
