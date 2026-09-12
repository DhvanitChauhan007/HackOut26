# MISSION
Build the backend API for "Circular Packaging & Materials Exchange" — a B2B marketplace connecting waste-generating businesses (sellers), material buyers, and logistics companies. Node.js + Express REST API on top of Supabase (Postgres + Auth + Storage + Realtime). Ship a running, seeded, tested API server that matches the contract below exactly, since a separately-built React frontend will integrate against it without seeing your code.

# TECH CONSTRAINTS
- Runtime: Node.js (LTS) + Express
- DB/Auth/Storage/Realtime: Supabase (`@supabase/supabase-js`). Auth = Supabase Auth (email/password) only — no separate custom JWT layer. Protected routes verify the bearer token via `supabase.auth.getUser(token)`.
- Maps: Google **Distance Matrix API** (driving distance/duration) for cost estimation, called server-side only (billing-sensitive key), cached in `distance_cache`. The frontend handles address→lat/long itself via Google Places Autocomplete — you do NOT need a geocoding endpoint; clients send lat/long directly.
- Deployment: include a `Dockerfile`.
- All monetary/decay/timeout constants come from environment variables, never hardcoded — the same code must support fast "demo" timings and realistic "production" timings via env swap.

# ENVIRONMENT VARIABLES
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=      # backend only, never exposed to frontend
GOOGLE_MAPS_API_KEY=            # Distance Matrix, server-restricted
COST_PER_KM=0.75                # illustrative logistics cost rate
DECAY_WINDOW_SECONDS=604800     # 7 days prod; use 180 for demo builds
DECAY_FLOOR_PCT=0.4             # price floor = list_price * this
RECYCLER_FALLBACK_TIMEOUT_SECONDS=172800  # 2 days prod; use 30 for demo
PORT=4000
BATCH_ELIGIBLE_DECAY_PCT=0.8    # fraction of the way from list_price to price_floor before a listing becomes batch-eligible
BATCH_MATCH_RADIUS_KM=50        # only combine listings whose pickup points are within this radius
BATCH_MIN_ITEMS=2               # lot opens (becomes purchasable) once it reaches this many contributing listings
BATCH_MAX_ITEMS=10              # cap per lot
BATCH_FORMING_TIMEOUT_SECONDS=259200   # 3 days prod; shrink for demo — undersized lots dissolve after this
```

# DATABASE SCHEMA (create in Supabase)
- **users**: id (uuid, = supabase auth uid), name, role enum(`manufacturer`,`retailer`,`recycler`,`logistics`), address text, lat float, long float, is_fixed_recycler bool default false, is_seed bool default false, auto_accept bool default false, created_at
- **listings**: id uuid pk, seller_id fk users, material_type text, sub_grade text, contamination_pct numeric, quantity numeric, unit text, condition text, photo_url text, list_price numeric, price_floor numeric, decay_window_seconds int, pickup_lat float, pickup_long float, status enum(`open`,`claimed`,`completed`) default `open`, created_at
- **requests**: id uuid pk, listing_id fk, buyer_id fk users, status enum(`pending`,`accepted`,`declined`) default `pending`, created_at
- **transactions**: id uuid pk, listing_id fk, request_id fk, buyer_id fk, seller_id fk, distance_km numeric, estimated_cost numeric, status enum(`pending`,`estimated`,`committed`,`completed`), impact_kg_diverted numeric, impact_co2e_kg numeric, created_at, completed_at
- **jobs**: id uuid pk, transaction_id fk, logistics_company_id fk users (nullable), pickup_lat, pickup_long, dropoff_lat, dropoff_long, distance_km, estimated_cost, status enum(`open`,`assigned`,`delivered`) default `open`, created_at, assigned_at, delivered_at
- **distance_cache**: id pk, origin_lat, origin_long, dest_lat, dest_long (rounded to ~4 decimals for cache key), distance_km, duration_min, cached_at
- **notifications**: id pk, user_id fk, message text, type text, read bool default false, created_at
- **emission_factors**: material_type text pk, co2e_kg_per_kg numeric, source_note text
- **ratings**: id uuid pk, transaction_id fk, rater_id fk users, ratee_id fk users, rating int (1-5), comment text nullable, created_at. Unique on (transaction_id, rater_id, ratee_id) — supports multiple ratees per transaction (bulk lots).
- **bulk_lots**: id uuid pk, material_type text, sub_grade text, status enum(`forming`,`open`,`claimed`,`completed`,`dissolved`) default `forming`, total_quantity numeric, bulk_rate_per_kg numeric, created_at
- **bulk_lot_items**: id uuid pk, bulk_lot_id fk, listing_id fk, seller_id fk users, quantity numeric, pickup_lat float, pickup_long float
- **job_stops**: id uuid pk, job_id fk, listing_id fk, seller_id fk users, pickup_lat float, pickup_long float, seq_order int (only populated for bulk jobs; single-seller jobs keep using `jobs.pickup_lat/pickup_long` directly)
- **bulk_rates**: material_type text pk, bulk_rate_per_kg numeric (illustrative placeholder values — not sourced from real market pricing, flag clearly in seed comments)
- `transactions` gains nullable `bulk_lot_id`; `listing_id` and `seller_id` become nullable — exactly one of {listing_id+seller_id} or {bulk_lot_id} is set per row
- `ratings` unique constraint changes to (transaction_id, rater_id, ratee_id) — a bulk transaction has one buyer rating each contributing seller, and each seller rating the buyer back

## Emission factor seed data — be upfront about precision
Seed every material_type you support (cardboard, PET, HDPE, LDPE, wood_pallet, mixed_plastic) with the **same blended value**:
```
co2e_kg_per_kg = 3.12
source_note = "Blended from EPA's mixed-recyclables factor: 2.83 MTCO2E avoided per short ton
recycled vs. landfilled (EPA Greenhouse Gas Equivalencies Calculator, epa.gov/energy/
greenhouse-gas-equivalencies-calculator-calculations-and-references), converted to kg.
NOT material-specific — swap in EPA WARM's per-material recycling factors
(epa.gov WARM Containers, Packaging and Non-Durable Goods documentation) for precision."
```
Do not let any generated UI copy or API description present this as material-specific.

# API CONTRACT (must match exactly — the frontend is built against this)
| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | /api/users/me | yes | `{name, role, address, lat, long}` | create/complete profile after Supabase signup |
| GET | /api/users/me | yes | — | current profile |
| POST | /api/listings | yes (seller) | `{material_type, sub_grade, contamination_pct, quantity, unit, condition, photo_url, list_price, price_floor, pickup_lat, pickup_long}` | decay_window_seconds set from env |
| GET | /api/listings | no | query: `material_type, max_distance_km, buyer_lat, buyer_long, min_quantity` | returns computed `current_price` per item; triggers recycler-fallback check (see logic) |
| GET | /api/listings/:id | no | — | same fallback check |
| PATCH | /api/listings/:id | yes (owner) | partial fields | only while `open` |
| POST | /api/listings/:id/requests | yes (buyer) | — | creates `pending` request |
| PATCH | /api/requests/:id | yes (seller) | `{status: accepted\|declined}` | accept locks listing, declines other pending requests, creates transaction |
| POST | /api/transactions/:id/estimate | yes | — | Distance Matrix (cached) → distance_km, estimated_cost; status→`estimated` |
| POST | /api/transactions/:id/commit | yes | — | status→`committed`; creates `jobs` row |
| GET | /api/jobs | yes (logistics) | query: `status, lat, long` | proximity-sorted (haversine, application-side — no external call needed for this sort) |
| POST | /api/jobs/:id/claim | yes (logistics) | — | only if `open`; sets `assigned`; notifies buyer+seller |
| POST | /api/jobs/:id/deliver | yes (assigned logistics co.) | — | only if `assigned`; sets `delivered`; transaction/listing → `completed`; computes impact; notifies buyer ("delivered to you") + seller ("delivery confirmed") |
| GET | /api/notifications | yes | — | current user's notifications (also available live via Supabase Realtime `postgres_changes` on this table, filtered by user_id — frontend subscribes directly) |
| PATCH | /api/notifications/:id/read | yes | — | |
| GET | /api/impact/summary | yes | — | aggregate kg diverted, co2e avoided, cost savings for current user |
| POST | /api/transactions/:id/ratings | yes (buyer, or a seller party on that transaction) | `{ratee_id, rating, comment}` | `ratee_id` required for bulk transactions (multiple possible ratees); inferred automatically for single-seller transactions; 409 if this (transaction, rater, ratee) already rated |
| GET | /api/users/:id/ratings | no | — | list + average rating for a company, shown on their listings/profile |
| GET | /api/bulk-lots | no | query: `material_type, max_distance_km, buyer_lat, buyer_long` | open lots only, priced at `bulk_rate_per_kg * total_quantity` |
| GET | /api/bulk-lots/:id | no | — | detail; contributing seller identities are not exposed pre-purchase |
| POST | /api/bulk-lots/:id/purchase | yes (buyer) | — | only if `status='open'`; **auto-completes immediately, no seller approval** (sellers pre-consented by entering the pool); creates one `transactions` row with `bulk_lot_id` set, marks lot + all contributing listings `claimed` |

# CORE BUSINESS LOGIC
1. **Price decay** (computed at read time, no cron):
   `current_price = max(price_floor, list_price - (elapsed_seconds / decay_window_seconds) * (list_price - price_floor))`
2. **Fixed-recycler fallback** (evaluated lazily inside `GET /api/listings` and `GET /api/listings/:id`): if `status='open'`, price has been at floor for ≥ `RECYCLER_FALLBACK_TIMEOUT_SECONDS`, and no accepted request exists → auto-create a request from the `is_fixed_recycler=true` account, immediately mark it `accepted`, and run it through the **exact same accept-request code path** as a normal acceptance (don't fork the logic).
3. **Accept/decline**: accepting locks the listing (`claimed`), auto-declines other pending requests, creates a `transactions` row.
4. **Estimate**: call Distance Matrix between listing pickup coords and buyer coords; check `distance_cache` first (rounded coords as key); `estimated_cost = distance_km * COST_PER_KM`.
5. **Deliver**: on delivery, compute `impact_kg_diverted = listings.quantity` (normalized to kg) and `impact_co2e_kg = kg * emission_factors[material_type].co2e_kg_per_kg`; store on the transaction.
6. **Ratings**: on `POST /api/transactions/:id/ratings`, reject unless `transactions.status='completed'`, unless the caller is a legitimate party on that transaction (buyer, or one of the contributing sellers for a bulk transaction), and unless (transaction, rater, ratee) hasn't already been rated. For single-seller transactions, ratee is inferred; for bulk, the caller supplies `ratee_id` (must be one of the transaction's actual contributing sellers, or the buyer). `GET /api/users/:id/ratings` returns the list plus a computed average (query-time aggregate, not stored/synced).
6b. **Bulk batching funnel**: when a listing's computed `current_price` crosses `BATCH_ELIGIBLE_DECAY_PCT` of the way to `price_floor` (evaluated lazily, same pattern as recycler fallback — on read, no cron), look for a `bulk_lots` row with matching material_type+sub_grade, status `forming`, and at least one existing item within `BATCH_MATCH_RADIUS_KM` of this listing; join it (insert into `bulk_lot_items`, increment `total_quantity`), or create a new `forming` lot. Once a lot reaches `BATCH_MIN_ITEMS`, flip it to `open` (now visible via `GET /api/bulk-lots`). If a `forming` lot exceeds `BATCH_FORMING_TIMEOUT_SECONDS` without reaching minimum size, dissolve it (delete the lot, its items simply stop being associated — their own individual decay/fallback timelines were never paused and continue unaffected).
6c. **Bulk purchase**: `POST /api/bulk-lots/:id/purchase` only succeeds if `status='open'`. No approval step — auto-creates one `transactions` row (`bulk_lot_id` set, `listing_id`/`seller_id` null), flips the lot and every contributing listing to `claimed`. Price = `bulk_rate_per_kg * total_quantity` (per-seller share = `bulk_rate_per_kg * that seller's contributed quantity` — purely linear, no proportional-split math needed).
6d. **Bulk logistics**: on commit, create the `jobs` row as usual plus one `job_stops` row per contributing listing (seq_order = insertion order — do not attempt route optimization here, sum-of-Distance-Matrix-legs-in-insertion-order is sufficient and consistent with the earlier no-VRP decision). Estimate/cost = sum of each leg's Distance Matrix result (each leg cached in `distance_cache` individually) x `COST_PER_KM`. Claim/deliver behave exactly as for single-seller jobs — no per-stop completion tracking in MVP (stretch only).
6e. **Independent fallback race**: a listing's own recycler-fallback timeline (per the original per-listing logic) is never paused by bulk-lot membership. If it fires while the listing is still in a `forming` or `open` bulk lot, remove it from `bulk_lot_items` (decrement `total_quantity`; if this drops an `open` lot below `BATCH_MIN_ITEMS`, that's acceptable — existing purchases of that lot are unaffected, just stop advertising it as available if quantity is now 0) and route it to the fixed recycler independently.
6f. **If short on time**: fall back to same-seller-only batching — a seller's own stale listings merge into one bigger listing, no `job_stops`/multi-stop logistics, no multi-seller rating attribution. Document this in your final report if you take this path rather than silently shipping a partial cross-seller version.
7. **Notifications**: just insert correctly-addressed rows — Supabase Realtime handles push to the frontend, no server-side websocket code needed.
8. **Seed script** (`seed.js`, idempotent — clear `is_seed=true` rows before re-inserting): ~6 seed accounts across all four roles (`auto_accept=true` for seed buyer/logistics accounts), exactly one `is_fixed_recycler=true` account, 8–10 sample listings across material types with varied pricing/decay windows.

# VERIFICATION (run these yourself, report results)
1. `npm install && npm run dev` — boots cleanly.
2. Run seed script; confirm rows in Supabase, including the fixed-recycler account.
3. Via curl/REST client: sign up manufacturer → create listing → sign up buyer → browse/filter → request → accept (as seller) → estimate (stub the Google call behind a swappable interface if no key yet) → commit → confirm job appears in `GET /api/jobs?status=open` → claim (as logistics) → deliver → confirm notifications exist for both parties and `impact_kg_diverted`/`impact_co2e_kg` are populated.
4. Complete one transaction end-to-end, then confirm both `POST /api/transactions/:id/ratings` calls succeed (buyer->seller and seller->buyer), a third attempt from either side returns 409, and `GET /api/users/:id/ratings` reflects the correct average.
5. Manually backdate a seed listing's `created_at` past decay window + fallback timeout; confirm the next `GET /api/listings/:id` call auto-generates and auto-accepts a request from the fixed-recycler account.
6. Report any endpoint that deviates from the contract above, and why.
