# Company A · Brand X dealership

Website and lead desk for an authorised Brand X dealer in Lucknow (3 showrooms, certified used-car yard).

Buyers browse new and used cars with **real on-road prices broken down by city**, work out an EMI, and **book a test drive in a real slot**. Every enquiry is **auto-assigned to a named consultant** and acknowledged at once; consultants work from a **lead inbox with response timers, an AI buyer summary and an editable first-reply draft**. Admins manage models, prices, tax tables, used stock and staff.

| | |
|---|---|
| Backend | FastAPI, SQLAlchemy 2 (async), PostgreSQL 16, Alembic |
| Frontend | React 19, React Router 7, TanStack Query, plain CSS modules, Vite |
| AI | Groq (OpenAI-compatible) with a deterministic rules fallback |
| Hosting | Render (API + Postgres), Vercel (web) |

## Quick start

Needs Docker, [uv](https://docs.astral.sh/uv/) and Node 20+.

```bash
docker compose up -d db                          # Postgres on :5433
cd backend
cp .env.example .env                             # then set JWT_SECRET (any long random string)
uv sync && uv run alembic upgrade head
uv run python -m app.seed                        # sample data from the brief + demo users
uv run uvicorn app.main:app --reload             # http://localhost:8000/api/docs

cd ../frontend && npm install && npm run dev     # http://localhost:5173
```

Demo logins (password `Demo@1234`): `buyer@demo.in`, `aman@demo.in` (consultant), `admin@demo.in`. The sign-in page has one-click buttons for each.

## Tests

```bash
cd backend && uv run pytest        # 62 tests: pricing, assignment, slots, AI guardrails, API + access control
cd frontend && npm test            # EMI and formatting
```

## Docs

- [deployment.md](deployment.md): run locally, deploy, environment variables, demo logins
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how it fits together: data model, flows, AI, security, performance
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): handoff guide: conventions, recipes for common changes, known gaps
- [docs/TDD.md](docs/TDD.md): technical design document (submission)
- [docs/brief.md](docs/brief.md): the client brief

## Repository map

```
backend/
  app/
    models/       SQLAlchemy tables (catalog, used, users, leads)
    schemas/      Pydantic request/response models
    routers/      HTTP endpoints, thin: validate, call services, shape responses
    services/     business logic: pricing, assignment, slots, ai, messaging, leads, csv_import
    seed.py       sample data
  migrations/     Alembic
  tests/
frontend/
  src/
    pages/        one file per screen (staff/ and admin/ are lazy-loaded)
    components/   ui/ primitives, car/ domain components, layout/
    lib/          api client, query hooks, formatting, EMI, auth
    i18n/         English and Hindi strings
```
