# Deployment

## Run it locally, step by step

Prerequisites: Docker, [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python 3.12 is installed by uv automatically), Node.js 20+.

1. **Start Postgres**

   ```bash
   docker compose up -d db
   ```

   Postgres 16 listens on `localhost:5433` (user, password and database are all `dealer`).

2. **Configure the API**

   ```bash
   cd backend
   cp .env.example .env
   ```

   Set `JWT_SECRET` in `.env` to a long random string, e.g. `openssl rand -hex 32`.
   Optionally set `GROQ_API_KEY` (free key from console.groq.com) to turn on the AI summaries; without it the app uses the rules fallback.

3. **Install, migrate, seed, run**

   ```bash
   uv sync
   uv run alembic upgrade head
   uv run python -m app.seed            # add --reset to wipe and reseed
   uv run uvicorn app.main:app --reload
   ```

   API docs: http://localhost:8000/api/docs

4. **Run the web app** (new terminal)

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open http://localhost:5173. Vite proxies `/api` to the API on port 8000.

5. **Run the tests** (optional)

   ```bash
   cd backend && uv run pytest      # creates and uses a separate dealer_test database
   cd frontend && npm test
   ```

## How it is deployed

```
Browser ──► Vercel (static React build)
              │  /api/*  and /sitemap.xml are rewritten (proxied) to ──►  Render web service (FastAPI)
              │                                                              │
              └──────────────────────────────────────────────────────────    └──► Render PostgreSQL
```

The browser only ever talks to the Vercel domain, so the session cookie is first-party (`SameSite=Lax`, `HttpOnly`, `Secure`) and no CORS is involved.

**API and database on Render.** `render.yaml` is a Render Blueprint. In Render choose *New → Blueprint*, point it at the repository, and it creates:

- `company-a-db`: PostgreSQL
- `company-a-api`: Python web service in `backend/`
  - build: `uv sync --frozen --no-dev`
  - pre-deploy: `alembic upgrade head` then `python -m app.seed` (the seed skips itself when data already exists)
  - start: `uvicorn app.main:app` behind Render's proxy
  - health check: `/api/health`

**Web on Vercel.** Import the repository, set the root directory to `frontend` (framework preset: Vite). `frontend/vercel.json` holds the API rewrites, SPA fallback, long-lived caching for hashed assets and security headers. If the Render service gets a different URL than `company-a-api.onrender.com`, update the two rewrite destinations in `vercel.json`.

The free Render plan sleeps when idle; the first request after a pause takes around 30 seconds.

## Environment variables

Names only. Values live in the hosting dashboards or a local `.env`, never in git.

**API (Render / `backend/.env`)**

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Render injects it; `postgres://` URLs are accepted) |
| `JWT_SECRET` | yes | Signs session tokens (Render generates one) |
| `COOKIE_SECURE` | prod | `true` in production so the session cookie is HTTPS-only |
| `PUBLIC_SITE_URL` | prod | Public web origin, used for sitemap links |
| `CORS_ORIGINS` | no | JSON list of allowed origins; only needed if the web app calls the API cross-origin |
| `GROQ_API_KEY` | no | Turns on LLM summaries and drafts; empty means the rules fallback |
| `GROQ_MODEL` | no | Defaults to `llama-3.1-8b-instant` |
| `SEED_PASSWORD` | no | Password for seeded demo users (defaults to the demo password below) |
| `TEST_DATABASE_URL` | tests | Database used by `pytest` (defaults to local `dealer_test`) |

**Web (Vercel)**

| Name | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | no | API base URL. Defaults to `/api` (the Vercel rewrite); set only if you skip the proxy |

## Demo login details

All demo accounts use the password **`Demo@1234`**. The sign-in page also has one-click demo buttons.

| Role | Email | What to try |
|---|---|---|
| Buyer | `buyer@demo.in` | My account: enquiries, test drives, opt-out, delete my data |
| Sales consultant | `aman@demo.in` | Lead inbox at `/staff`: timers, AI summary, edit and send the draft, reassign, CSV import |
| Other consultants | `priya@`, `rohit@`, `sana@`, `vikas@`, `pooja@demo.in` | Leads are spread across them by showroom and model |
| Admin | `admin@demo.in` | `/admin`: price table, cities and tax slabs, models, used stock, users and roles |

A sample portal export for the CSV import is at `/sample-portal-leads.csv` (also downloadable from the import dialog). It includes a duplicate and invalid rows on purpose.
