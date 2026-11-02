# Architecture

## Shape of the system

```
React SPA (Vite) ──HTTP/JSON──► FastAPI ──SQLAlchemy async──► PostgreSQL
  TanStack Query cache            routers → services → models
                                  │
                                  ├─► Groq LLM (optional, 8 s timeout)
                                  └─► messaging (mocked WhatsApp/SMS → lead timeline)
```

One API, one database, one SPA. There are no queues or caches to run: background work (AI summaries) uses FastAPI `BackgroundTasks` after the response is sent. That is enough for ~4,500 leads a month (about one every 10 minutes).

### Backend layers

| Layer | Rule |
|---|---|
| `routers/` | Parse and validate input (Pydantic), check access, call services, shape the response. No business rules. |
| `services/` | Business logic. The core rules are **pure functions** (`pricing.on_road_price`, `assignment.pick_consultant`, `slots.day_slots`, `ai.guardrail_flags`, `ai.rules_summary`) so they are unit-tested without a database. |
| `models/` | SQLAlchemy tables. Enums are stored as `VARCHAR + CHECK` (`db_enum`), so adding a value is a small migration. |
| `schemas/` | Request/response shapes. Masking (used-car registration) happens here, so it cannot be forgotten in a route. |

### Frontend layers

| Folder | Role |
|---|---|
| `lib/api.ts` | `fetch` wrapper: cookies, JSON, turns FastAPI errors into `ApiError` with per-field messages |
| `lib/queries.ts`, `lib/staff.ts`, `lib/admin.ts` | Every server call as a TanStack Query hook with one cache-key scheme |
| `components/ui` | Primitives: Button, Field, Chip/Tag, Sheet (native `<dialog>`), Img, loading/empty/error states |
| `components/car` | Domain pieces: PriceBreakup, EmiCalculator, cards, ContactForm |
| `pages/` | One file per screen. Staff and admin are lazy chunks a buyer never downloads. |

## Data model

```
cities ─┬─< road_tax_slabs              (fuel, min_price, max_price, rate %)
        └─< variant_prices >── variants >── car_models ─┬─< colours
                (ex_showroom, valid_until)               └─< accessory_packs
showrooms ─< demo_cars >── variants
showrooms ─< users (consultants) >─< consultant_models >── car_models
showrooms ─< used_cars                   (registration_no stored in full, masked on output)
leads ─┬─< lead_events                   (append-only timeline: created, assigned, message, status, ai)
       └─< test_drives >── demo_cars     (unique (demo_car_id, starts_at) WHERE status = 'booked')
leads >── car_models | used_cars | showrooms | users (assigned_to, buyer)
```

Money is whole rupees (`int`). Rates are `NUMERIC(5,2)` percentages. Times are `timestamptz`; slot maths happens in IST.

## Main flows

### On-road price (the hard part)

`GET /api/models/{slug}/price?variant_id&city&pack_id`

1. Load the variant's row in `variant_prices` for that city. If it is missing, return 404 ("not priced for this city"). The API never guesses a price.
2. Load the city's fees and tax slabs.
3. `pricing.on_road_price()` builds the line items:
   - ex-showroom
   - road tax: the slab matching *fuel* and *price*, as % of ex-showroom
   - registration + HSRP and FASTag: flat, per city
   - insurance: % of ex-showroom, per city
   - TCS: 1%, only above ₹10 lakh
   - optional accessory pack
4. The response carries every line, the rate used, the total and `valid_until`. The UI renders it as a receipt with the validity date and a "prices may change" note.

Admins edit both inputs: the price grid (variant × city) and city fees and slabs. Slabs are validated (`pricing.validate_slabs`): each fuel must start at ₹0, have no gaps or overlaps, and end open-ended. The buyer-facing page never sees a half-configured table.

### Enquiry → named consultant within seconds

`POST /api/leads` (or `/api/test-drives`, or a portal CSV row)

1. Validate: Indian mobile normalised to 10 digits, DPDP consent must be `true`.
2. `create_lead`, in one transaction:
   - insert the lead and a `created` event
   - `auto_assign`: take a Postgres advisory lock, so two simultaneous leads can't both pick the "least loaded" consultant, then call `pick_consultant`
   - send the acknowledgement template with the consultant's name (mocked, written to the timeline; skipped if the buyer opted out)
3. Commit, return the consultant's name to the buyer, then run the AI summary in the background.

`pick_consultant` preference: same showroom and sells this model → same showroom → any showroom and sells this model → anyone. It then picks the fewest open leads, then whoever was assigned least recently.

### Test-drive booking

- Slots are fixed windows (default 60 min) inside showroom hours, at least 2 hours ahead, up to 14 days out (`slots.day_slots`).
- A booking is accepted only if the requested start is one of those slots.
- Double booking is impossible: a **partial unique index** on `(demo_car_id, starts_at) WHERE status = 'booked'` makes Postgres reject the second insert. The API turns that into a 409 and the UI clears the slot and refreshes the grid.
- Abuse guard: at most 2 upcoming bookings per phone number.

### AI: buyer summary and first-reply draft

`services/ai.py`, run once per lead in the background and on demand ("Regenerate").

```
LeadContext ──► Groq (JSON mode, temp 0.2, 8 s timeout)
                  │ ok?  ── no ──────────────────────────────► rules_summary + rules_draft, flag llm_failed
                  ▼
              Pydantic-validate {summary, draft}  ── invalid ─► rules fallback, flag llm_failed
                  ▼
              guardrail_flags(draft)  ── discount / price ───► keep summary, swap draft for the template,
                  ▼                                             flag draft_replaced:<reason>
              use as-is
```

- The system prompt treats the buyer's message as data, not instructions. Guardrails run on the output anyway, so prompt injection can't make a draft promise a discount.
- **Confidence** comes from what the buyer actually said (budget, timeline, finance, interest, preferences), not from the model's opinion. Low confidence shows as "unsure: confirm with buyer", alongside the questions the consultant should ask.
- Drafts are **never sent automatically**. The consultant edits and sends. The send endpoint blocks discount wording again on the server.
- Each result records `source` (`llm` or `rules`) and `flags`. The inbox explains in plain words why it fell back.

### Lead inbox

- Leads still waiting for a first response sort to the top. Each row shows a live timer that turns red after the SLA (5 minutes, configurable).
- The header shows open leads, awaiting reply, overdue, the share answered within the SLA over 30 days, and the median first response. All of it comes from one aggregate SQL query.
- First response is recorded by the first message, a logged call, or moving the lead out of "new".
- Consultants see their own leads, their showroom's leads and the unassigned queue (`visible_to`); admins see everything. Anything outside scope returns 404, not 403, so lead IDs don't leak.

## Security

- **Auth:** JWT in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). Passwords are Argon2 (`pwdlib`). Login takes the same time for unknown emails.
- **Roles:** `buyer`, `consultant`, `admin`, enforced per route by dependency (`StaffUser`, `AdminUser`). Admins cannot remove their own admin access.
- **Input:** every body and query is a Pydantic model with bounds. Search escapes LIKE wildcards. CSV uploads are capped at 1 MB / 2,000 rows and validated row by row.
- **Personal data (DPDP Act 2023):**
  - consent is required and timestamped
  - opt-out at account level stops all messages
  - "Delete my data" anonymises the account, its leads and timeline bodies, and cancels upcoming bookings
  - registration numbers are masked publicly
- **Secrets:** none in the repo. `.env` is git-ignored; Render generates `JWT_SECRET`.

## Performance

- **Initial load:** about 108 KB gzipped vendor (React, Router, Query) plus about 25 KB app. Every route except the home page is a lazy chunk; staff and admin code never reaches buyers.
- **No UI framework, no animation library, no web fonts.** System font stack, CSS transitions on `transform`/`opacity` only, `prefers-reduced-motion` respected.
- **Images:** responsive `srcset` from the CDN, explicit aspect ratios (no layout shift), lazy below the fold, `fetchpriority=high` for the hero.
- **Data:**
  - server-side filtering, sorting and pagination
  - `keepPreviousData`, so pages and filters swap without flashing skeletons
  - model pages prefetch on hover/focus
  - public GETs send `Cache-Control` with `stale-while-revalidate`
  - indexes match the list queries: `(status, price)`, `(status, created_at)`, `(assigned_to_id, status)`
- **Inbox:** one coarse 10-second clock drives every timer; lists poll every 20 seconds.

## SEO

- Every model and used car has its own URL with a `<title>`, meta description and canonical link (React 19 hoists these into `<head>`).
- `/sitemap.xml` is generated from the database.
- `robots.txt` keeps `/staff`, `/admin` and `/account` out of search.
- This is a client-rendered app. Google renders it, but pre-rendering the model and used-car pages is the first item under "next" for faster first paint and other crawlers.
