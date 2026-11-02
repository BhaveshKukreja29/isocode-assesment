# Development guide

How to keep working on this codebase without the original author. Read [ARCHITECTURE.md](ARCHITECTURE.md) first.

## Daily loop

```bash
docker compose up -d db
cd backend && uv run uvicorn app.main:app --reload     # :8000
cd frontend && npm run dev                              # :5173, proxies /api
```

Before committing:

```bash
cd backend && uv run ruff check . && uv run ruff format . && uv run pytest
cd frontend && npm run lint && npm test && npm run build
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push.

Reset demo data at any time with `uv run python -m app.seed --reset`.

## Conventions

- **Routers stay thin.** If a route needs an `if` that encodes a business rule, move it into `services/` as a pure function and unit-test it.
- **Money is `int` rupees.** Percentages are `Decimal`. Round with `pricing.percent_of` (half-up).
- **Times are `timestamptz`.** Convert to IST (`app.config.IST`) only for display and slot maths.
- **Every lead change writes a `LeadEvent`** (`services.leads.add_event`). The timeline is the audit trail.
- **Outbound messages go through `services.messaging.send`.** It enforces the opt-out.
- **Frontend data access goes through hooks** in `lib/queries.ts`, `lib/staff.ts` and `lib/admin.ts`. Never call `fetch` in a component.
- **Buyer-facing text lives in `src/i18n/en.ts` and `hi.ts`.** TypeScript makes `hi.ts` fail to compile when a key is missing. Staff and admin screens are English only.
- **Styling:**
  - Design tokens live in `src/styles/global.css`: one accent colour (`--accent`), dark panels via the `.dark` class.
  - Use CSS modules per component.
  - Wrap global classes in `:global(...)` inside a module. Otherwise they get hashed and silently stop matching.
- **Comments explain why, not what.**

## Recipes

### Add a database column

1. Edit the model in `backend/app/models/`.
2. `uv run alembic revision --autogenerate -m "short description"`, then read the generated file.
3. `uv run alembic upgrade head`.
4. Add the field to the relevant schema in `app/schemas/`, then to `frontend/src/lib/types.ts`.

### Add a registration city

Admin → *Cities & tax* edits existing cities. To add a new one, insert a row into `cities` with its slabs (see `CITIES` in `app/seed.py` for the shape), then fill its column in Admin → *Price table*. Until a variant has a price for the city, the model page says "not priced for {city} yet" instead of guessing.

### Change how leads are routed

`services/assignment.py::pick_consultant` is pure. Change the pools or the sort key, then update `tests/test_assignment.py`.

### Use a different LLM

`services/ai.py::_call_llm` is the only provider-specific code. It expects JSON matching `LLMOutput`. Anything that fails validation or the guardrails falls back automatically, so a new provider can't make drafts unsafe.

### Send real WhatsApp/SMS

Replace the body of `services/messaging.py::send` with a provider call (Gupshup, MSG91, WhatsApp Cloud API). Keep writing the `LeadEvent` so the timeline stays complete. Templates are `acknowledgement()` and `test_drive_confirmation()`.

### Add a page

Create `src/pages/X.tsx` with a default export, then add a lazy route in `src/app/router.tsx`. Use `<title>` and `<meta>` in the component for SEO. Use `ErrorState`, `EmptyState` and `Skeleton` for the three non-happy states.

## Testing notes

- `tests/test_api.py` runs against a real Postgres database (`dealer_test`, created automatically). It is seeded once per session with the same seed as the demo, so tests use realistic data. Tests that create data use unique phone numbers.
- LLM calls are never made in tests (`GROQ_API_KEY` is blanked in `conftest.py`). `test_ai.py` mocks the Groq HTTP API with `httpx.MockTransport` to cover success, discount drafts, HTTP errors and malformed JSON.

## Gotchas

- `uv run python -m app.seed` refuses to run on a non-empty database. Use `--reset` locally. Never use `--reset` in production.
- The partial unique index on `test_drives` is what prevents double booking. Don't replace it with an application-level check.
- Consultants get 404 (not 403) for leads outside their scope. That's intentional.
- Render's free Postgres expires after 30 days. Upgrade the plan, or recreate it and redeploy (pre-deploy migrates and seeds).

## Known gaps / backlog (most valuable first)

1. **Pre-render** model and used-car pages (e.g. `vite-plugin-ssr`/React Router framework mode) for faster first paint on 4G and non-Google crawlers.
2. **Service booking** by workshop bay capacity. This can reuse the slot engine with `bays` as capacity instead of one demo car.
3. **Used-car price band suggestion** from past sales of the same model, year and km, shown only to the used-car manager. Needs a `used_car_sales` table.
4. **Real messaging provider**, plus inbound replies and STOP handling over webhook.
5. **Rate limiting** on public POST endpoints (per IP and per phone), plus OTP verification of the phone number before booking.
6. **Photo upload** to object storage (S3/R2) instead of pasting URLs.
7. **Offers and banners** in the CMS, and the daily DMS CSV export.
8. Re-assignment of leads when a consultant is deactivated, and an escalation (notify the showroom manager) when a lead passes the SLA unanswered.
