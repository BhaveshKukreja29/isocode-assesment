# Technical Design Document: Company A dealership website and lead desk

**GitHub:** `https://github.com/<your-username>/<repo>` ← replace before submitting
**Live app:** `https://<your-app>.vercel.app` ← replace before submitting (demo logins in deployment.md)

---

## 1. What was built

The core build from the brief, end to end, on seeded sample data:

| Brief asks for | Built |
|---|---|
| Model and variant pages with on-road price by city | Model pages with photos, colours, specs, variant picker, line-by-line on-road breakup per city with validity date, accessory packs, EMI calculator |
| Certified used-car listings | Filterable, sortable, paginated listing; detail page with inspection report, masked registration, EMI and enquiry |
| Test-drive booking by showroom and demo car | Pick car → showroom → demo car → date → real slot; double booking impossible at database level |
| Lead inbox, auto-assigned, response timer, status | Live SLA timers, stats, scopes, status changes, reassignment, portal CSV import with dedupe |
| AI buyer summary and first-reply draft | LLM (Groq) with schema validation, guardrails, rules fallback and an honest confidence level; drafts are edited before sending |
| Admin for cars and prices | Price table (variant × city), cities and tax slabs, models and variants, used stock, users and roles |
| Roles | Buyer, sales consultant, admin |
| Trade-in form, Hindi/English, DPDP consent and opt-out | Built |

Mocked as allowed: WhatsApp/SMS (written to the lead timeline), payments (none needed), DMS.

## 2. Architecture and why

```
React SPA (Vercel) ──/api proxied──► FastAPI (Render) ──► PostgreSQL (Render)
                                         └──► Groq LLM (optional)
```

- **One API, one database, no queues.** The load is about 4,500 leads a month, roughly one every ten minutes. A single FastAPI process with async Postgres covers that with large headroom. AI runs as a background task after the response, so a slow LLM never slows a buyer down. Fewer moving parts means cheaper hosting within the ₹9 lakh budget, and easier for a small team to run.
- **FastAPI + SQLAlchemy async + Pydantic.** Typed validation on every input, OpenAPI docs for free, and business rules isolated as pure functions that are cheap to test.
- **PostgreSQL** carries real guarantees the product depends on:
  - a partial unique index makes double-booking a slot impossible
  - an advisory lock serialises lead assignment
  - `percentile_cont` computes the median response time in one query
- **React SPA without a UI framework.** The brief stresses speed on 4G and a premium, minimal look. Plain CSS modules, the system font stack and route-level code splitting keep the first load to about 135 KB of JS gzipped (React itself is most of that). TanStack Query handles caching, prefetching and "keep the previous page visible while the next loads", which is what makes browsing feel instant.
- **Vercel proxies `/api` to Render**, so the browser sees a single origin. The session lives in an `HttpOnly` cookie with no CORS or third-party-cookie issues.

## 3. Data model

```
cities ─┬─< road_tax_slabs (fuel, min_price, max_price, rate%)
        └─< variant_prices (ex_showroom, valid_until) >── variants >── car_models ─┬─< colours
                                                                                    └─< accessory_packs
showrooms ─< demo_cars >── variants
showrooms ─< users (role, showroom) >─< consultant_models (specialisation)
showrooms ─< used_cars (stock_id, year, km, owners, price, status, inspection JSON, registration_no)
leads (contact, kind, source, status, consent_at, opted_out, assigned_to, first_response_at, ai_summary, ai_draft)
  ├─< lead_events (append-only timeline)
  └─< test_drives (demo_car, starts_at, status)  UNIQUE(demo_car_id, starts_at) WHERE status='booked'
```

Money is stored as whole rupees, rates as `NUMERIC(5,2)` and times as `timestamptz` (slots computed in IST).

## 4. Main flows

**On-road price (the hard part).** Nothing is hard-coded per car.

1. The ex-showroom price comes from the admin price table for that variant and city.
2. The rest of the breakup comes from the city's admin settings:
   - road tax: the slab for the variant's fuel and price band
   - registration + HSRP and FASTag: flat fees
   - insurance: a percentage of ex-showroom
3. TCS (1%) is added above ₹10 lakh, plus an optional accessory pack.
4. Every line is shown with its rate, plus the total, the validity date and "prices may change".
5. If a variant has no price for a city, the page says so instead of guessing.
6. Slab tables are validated on save: start at ₹0, no gaps or overlaps, open-ended top.

Worked example, the brief's NEW-H-02 (Model H ZX automatic, ₹12,45,000 ex-showroom) in Lucknow:

| Line | Amount |
|---|---|
| Ex-showroom | ₹12,45,000 |
| Road tax 10% | ₹1,24,500 |
| Registration + HSRP | ₹2,450 |
| Insurance 3.4% | ₹42,330 |
| FASTag | ₹500 |
| TCS 1% | ₹12,450 |
| **On-road** | **₹14,27,230** |

**Enquiry → named consultant in seconds.** Web form, test-drive booking and portal CSV all go through one function.

1. Validate the phone and require consent.
2. Auto-assign. Preference order:
   - same showroom and sells this model
   - same showroom
   - sells this model
   - anyone

   Ties go to the fewest open leads, then whoever was assigned least recently.
3. Send the acknowledgement naming the consultant.
4. Return the consultant's name to the buyer ("Aman Verma will call you within 5 minutes").

Everything is logged on the lead timeline.

**Test drive.** Slots are fixed windows within showroom hours, at least 2 hours ahead and up to 14 days out. The server only accepts real slot starts. The database rejects a second booking of the same car and slot; the buyer sees "someone just booked that slot" and a refreshed grid. Each phone number can hold at most 2 upcoming bookings.

**Lead inbox.**
- Unanswered leads sort to the top, with a timer that goes red after 5 minutes.
- The header tracks open, awaiting reply, overdue, % answered within 5 minutes (30 days) and median first response. These map directly to the client's success metric of 90% of web leads called within 5 minutes.
- First response is recorded by a message, a logged call or a status change.
- Consultants see their own leads, their showroom's leads and the unassigned queue, and can reassign.

## 5. How the AI works, and what happens when it is wrong or unsure

1. **Input:** the lead's message, kind, source, model or used car, showroom, consultant, booked slot and trade-in details.
2. **LLM call:** Groq `llama-3.1-8b-instant` in JSON mode at temperature 0.2 with an 8-second timeout. The prompt asks for a structured summary (headline, interest, budget, timeline, finance, trade-in, preferences, questions to ask) and a short first reply. It forbids discounts and prices, and tells the model to treat the buyer's text as data, not instructions.
3. **Validation:** the output must match a Pydantic schema. If it doesn't, the rules fallback is used.
4. **Guardrails:** the draft is scanned for discount, offer and cashback wording and for any rupee amount or percentage. If either appears, the summary is kept but the draft is replaced with a safe template, and the reason is shown to the consultant.
5. **Fallback:** no API key, timeout, HTTP error or malformed output all lead to a deterministic keyword-based summary and template draft. Both handle Hinglish keywords for budget ("12 lakh"), timeline ("Diwali", "this week"), loan, exchange and preferences.
6. **Confidence:** computed from how many concrete facts the buyer gave, not from the model's self-assessment. Low confidence is labelled "unsure: confirm with buyer" next to the questions the consultant should ask.
7. **Human in the loop:** drafts are never auto-sent. The consultant edits and sends, and the server blocks discount wording at send time too. Prices only ever come from the admin table, and consultants can reassign any lead.

## 6. UI and design decisions

- **Showroom feel:** light pages with large photography and generous spacing, plus **dark panels** for the moments that matter: the header, hero, on-road price receipt, booking summary and AI card.
- **One accent:** electric lime `#C6F432`, used only for the next step (primary buttons), the on-road total and the marker under "Real slots."
- **Every car page ends in a price and a next step.** On phones a sticky bar keeps the on-road price and "Book a test drive" in reach.
- **Price as a receipt.** Dotted leaders, the rate next to each line, the total in the accent colour, and the validity date set in monospace. It reads as something you can trust and screenshot.
- **Mono details:** stock IDs, step numbers and validity use a monospace face, a small "spec sheet" touch that stays within a restrained palette.

**Key screens**

1. **Home:** promise strip (whole price / a slot, not a callback / a name in five minutes), the line-up with a city switcher, latest certified cars.
2. **Model page:** gallery, variant list with prices, live breakup, packs, EMI, specs, enquiry sheet.
3. **Used cars:** sidebar filters on desktop, a bottom sheet on phones; filters live in the URL so results are shareable; pages swap without flashing.
4. **Used-car detail:** facts grid, masked registration, inspection score ring and item list.
5. **Test drive:** six numbered steps on one page with a live summary; past or taken slots are struck through.
6. **Lead inbox:** split view (list and detail) on desktop, list then detail on phones.
7. **Admin:** price grid that highlights unsaved cells, slab editor with server-side validation.

**States:** every data view has a skeleton, an empty state with a way out, and an error state with retry. Forms show field-level messages from the server.

**Accessibility and performance:**
- native `<dialog>` for sheets, so focus trapping and Esc come free
- visible focus rings and labelled controls
- `prefers-reduced-motion` respected
- images sized with `srcset` and fixed aspect ratios, so nothing shifts while loading
- Hindi/English toggle on all buyer-facing text

## 7. Assumptions (all labelled; not stated in the brief)

1. **A1:** Uttar Pradesh road tax is 8% up to ₹10 lakh and 10% above; EVs are exempt. Delhi uses three slabs with higher diesel rates. Delhi is included only to demonstrate a different tax regime.
2. **A2:** Insurance is estimated as a percentage of ex-showroom per city (3.3–3.65%); registration + HSRP and FASTag are flat per city.
3. **A3:** TCS of 1% applies above ₹10 lakh ex-showroom.
4. **A4:** Ex-showroom prices differ slightly between cities (logistics); price validity is about one month.
5. **A5:** Model names and variants beyond the three sample rows (Model S/C/H/E and their specs and prices) are invented for the demo. Photos are royalty-free stock placeholders, labelled as representative.
6. **A6:** All three showrooms are in Lucknow and open 10:00–19:00. Test-drive slots are 60 minutes, at least 2 hours ahead, up to 14 days out.
7. **A7:** The response SLA is 5 minutes, measured from lead creation (or portal receipt time for imports) to the first message, logged call or status change.
8. **A8:** Consultants belong to one showroom and may specialise in models. Generalists take any model.
9. **A9:** Portal leads carry consent given on the portal.
10. **A10:** The dealer's trading name is shown as "Company A" and the brand as "Brand X", as in the brief.
11. **A11:** Buyers can book without an account; an account adds history and privacy controls.
12. **A12:** Staff and admin screens are English only; buyer-facing pages are Hindi and English.

## 8. What I cut, and what I would do next

**Cut (outside the core build or the time box)**
- service booking by workshop bay capacity
- used-car price band suggestion
- offers and banners CMS
- photo upload (URLs are pasted)
- real WhatsApp/SMS provider
- OTP phone verification
- rate limiting
- server-side rendering

**Next, in order**
1. Pre-render model and used-car pages for faster first paint on 4G and broader SEO.
2. Service booking, reusing the slot engine with bay capacity.
3. Real messaging provider, inbound STOP handling, and escalation to the showroom manager when a lead passes 5 minutes.
4. Used-car price band from past sales (model, year, km), visible only to the used-car manager.
5. OTP verification and rate limits on public forms.
6. Photo upload to object storage, the offers CMS and the daily DMS CSV export.

## 9. Tests and quality

- **Backend (62 tests):**
  - on-road pricing, including the brief's sample car, slab boundaries, TCS threshold and slab validation
  - assignment preferences
  - slot generation
  - AI guardrails and every fallback path, with a mocked LLM
  - API tests on a real Postgres for double booking, consent, access control by role and showroom, reply guardrail, CSV dedupe, admin price change flowing to the public price, and buyer opt-out
- **Frontend:** EMI and formatting tests.
- **CI:** lint, tests and build on every push.
- **Commit history:** small, frequent commits.
