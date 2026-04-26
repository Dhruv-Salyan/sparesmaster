# 🚀 Deployment Guide — SparesMaster

A step-by-step reference for deploying SparesMaster to the cloud.  
Choose any platform below — all are beginner-friendly and have free tiers.

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Render](#render)
- [Railway](#railway)
- [Vercel (Frontend Only)](#vercel-frontend-only)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Before You Start

Make sure you have:

- ✅ Code pushed to a **GitHub repository** (see [Git commands in README](README.md#git-commands))
- ✅ A `.env.example` file committed (it tells the platform what variables to set)
- ✅ **Never committed** your real `.env` file

---

## Render

**Best for:** Full-stack deployment with persistent SQLite storage  
**Free tier:** 750 hours/month (enough for one always-on app)  
**SQLite support:** ✅ Yes, via persistent Disk

### Step 1 — Sign up

Go to [render.com](https://render.com) and sign up with your GitHub account.

### Step 2 — One-click deploy (Blueprint)

This repo includes a `render.yaml` file that configures everything automatically.

1. In Render dashboard: **New** → **Blueprint**
2. Connect your GitHub repository
3. Click **Apply** — Render reads `render.yaml` and creates the service + disk

Skip to [Step 5](#step-5--verify) if you use Blueprint.

### Step 3 — Manual deploy (alternative)

1. **New** → **Web Service**
2. Connect your GitHub repository
3. Fill in:
   | Field | Value |
   |-------|-------|
   | Root Directory | `backend` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |

### Step 4 — Add Persistent Disk

> ⚠️ **Critical:** Without this, your data is lost every time the app restarts.

1. In your Web Service → **Disks** tab → **Add Disk**
2. Settings:
   | Field | Value |
   |-------|-------|
   | Name | `sparesmaster-db` |
   | Mount Path | `/var/data` |
   | Size | 1 GB |

### Step 4b — Add Environment Variables

In your Web Service → **Environment** tab:

```
NODE_ENV        = production
DB_PATH         = /var/data/inventory.db
CORS_ORIGIN     = *
LOG_LEVEL       = info
RATE_LIMIT_MAX  = 100
```

### Step 5 — Verify

Once deployed (takes ~2 minutes):

1. Visit `https://your-app.onrender.com/api/health`  
   You should see: `{"success":true,"message":"API is running",...}`

2. Visit `https://your-app.onrender.com`  
   The SparesMaster dashboard should load.

3. **Seed sample data** (optional):  
   Render dashboard → your service → **Shell** tab:
   ```bash
   node scripts/seed.js
   ```

### Render — Common Issues

| Problem | Solution |
|---------|----------|
| App restarts and data disappears | You forgot to add the Disk — add it and redeploy |
| Build fails | Check the build logs; likely a missing `package.json` in `backend/` |
| Health check fails | Make sure Start Command is `npm start` and ROOT is `backend` |
| 502 errors on first load | Free tier apps sleep after inactivity — first request takes ~30s to wake |

---

## Railway

**Best for:** Fast deploys, great developer experience  
**Free trial:** $5 credit (no credit card required)  
**SQLite support:** ✅ Yes, filesystem persists between deploys

### Step 1 — Sign up

Go to [railway.app](https://railway.app) and sign up with GitHub.

### Step 2 — Create project

1. **New Project** → **Deploy from GitHub repo**
2. Select your `sparesmaster` repository
3. Railway detects Node.js automatically and uses `railway.toml`

### Step 3 — Add environment variables

In Railway dashboard → your service → **Variables** tab:

```
NODE_ENV        = production
DB_PATH         = /app/db/inventory.db
CORS_ORIGIN     = *
LOG_LEVEL       = info
```

> Railway automatically provides `PORT` — you don't need to set it.

### Step 4 — Generate a domain

Railway dashboard → **Settings** → **Networking** → **Generate Domain**

Your app will be at `https://sparesmaster-production.up.railway.app`

### Step 5 — Verify

1. Visit `https://your-app.up.railway.app/api/health` — should return `{"success":true,...}`
2. Visit `https://your-app.up.railway.app` — dashboard should load

### Step 6 — Seed data (optional)

Railway dashboard → **Deploy** tab → click the active deployment → **View Logs**  
Or use the Railway CLI:

```bash
npm install -g @railway/cli
railway login
railway shell
node scripts/seed.js
```

### Railway — Common Issues

| Problem | Solution |
|---------|----------|
| Build fails | Confirm `railway.toml` has `buildCommand = "cd backend && npm install"` |
| Port not binding | Remove any `PORT=3000` from your Variables; Railway injects its own |
| App crashes immediately | Check deploy logs for the actual error message |

---

## Vercel (Frontend Only)

**Best for:** When your backend lives elsewhere (Render/Railway) and you want the fastest possible frontend CDN

**Free tier:** Unlimited for static/frontend projects

> 💡 Skip this if you deployed the full stack on Render or Railway — the frontend is already served by Express from `/`.

### Step 1 — Update API URL

Before deploying the frontend separately, update the API base URL in `frontend/js/app.js`:

```js
// Line 8 — change this:
const API_BASE = 'http://localhost:3000/api';

// To your deployed backend URL:
const API_BASE = 'https://sparesmaster-api.onrender.com/api';
```

Commit and push this change.

### Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Configure:
   | Field | Value |
   |-------|-------|
   | Root Directory | `frontend` |
   | Framework Preset | Other |
   | Build Command | _(leave empty)_ |
   | Output Directory | `.` |

4. Click **Deploy**

### Step 3 — Update CORS on backend

On your Render/Railway backend, update `CORS_ORIGIN` to your Vercel URL:

```
CORS_ORIGIN = https://sparesmaster.vercel.app
```

### Step 4 — Verify

Visit your Vercel URL — the dashboard should load and pull data from the backend.

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port Express listens on. Cloud platforms inject this automatically. |
| `NODE_ENV` | `development` | Set to `production` on all cloud deployments |
| `DB_PATH` | `./db/inventory.db` | Path to SQLite file. Use `/var/data/inventory.db` on Render |
| `CORS_ORIGIN` | `*` | Allowed origins. Use `*` for open access or a specific URL for production |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per IP per window |
| `LOG_LEVEL` | `info` | Log verbosity: `error`, `warn`, `info`, `debug` |

---

## Troubleshooting

### "Cannot reach backend" toast on dashboard

The frontend cannot connect to `localhost:3000`. This happens when:
- The backend server isn't running → run `npm start` in `backend/`
- You deployed the frontend to Vercel but forgot to update `API_BASE` in `app.js`

### Database resets on every deploy (Render)

You haven't attached a persistent Disk. Go to Render → your service → **Disks** → add one with mount path `/var/data`, then set `DB_PATH=/var/data/inventory.db`.

### 503 / app won't start on Render free tier

Free tier services sleep after 15 minutes of inactivity. The first request after sleep takes 20–30 seconds. Upgrade to Starter tier ($7/mo) for always-on.

### CORS errors in browser console

Set `CORS_ORIGIN` on your backend to exactly match your frontend's domain (no trailing slash):
```
CORS_ORIGIN = https://sparesmaster.vercel.app
```

---

*For more help, [open an issue](../../issues) on GitHub.*
