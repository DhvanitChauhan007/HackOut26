# Address → Distance → Rate → ETA — Full Workflow

## 0. What's actually missing (confirmed by reading the code)

| Gap | Where | Impact |
|---|---|---|
| Signup collects `address` text but never geocodes or sends `lat`/`long` | `src/routes/auth.tsx` → `server/api/users/me.ts` | Every real user has `lat: null, long: null`, so distance/rate can never be computed for them |
| `duration_min` is calculated in `estimate.ts` but never saved | `server/api/transactions/$id/estimate.ts` | ETA exists for one API response, then is lost — never reaches the job or the logistics dashboard |
| `jobs.pickup_location` / `dropoff_location` are never set on insert | `server/api/transactions/$id/commit.ts` | Dashboard shows `"undefined → undefined"` for the route label |
| Distance/duration fallback (no Google key) is a crude `straight-line × 1.3` guess | `src/services/distanceMatrix.ts` | Works and is free, but ETA accuracy is low |

The actual distance formula, the rate formula (`distance_km × COST_PER_KM`), and the caching pattern are already correctly built — nothing there needs rebuilding.

---

## 1. The full flow, once fixed

```
User types address at signup
        ↓
Geocode address → lat/long   [NEW — src/services/geocode.ts]
        ↓
Stored on users.lat/long (sellers will need the same on listings once that form exists)
        ↓
Buyer requests a transaction estimate
        ↓
getDistance(pickup, dropoff) → distance_km + duration_min   [ALREADY BUILT]
        ↓
estimated_cost = distance_km × COST_PER_KM                  [ALREADY BUILT]
        ↓
FIX: persist duration_min on the transaction, not just distance/cost
        ↓
Buyer/seller commit → job created
        ↓
FIX: copy duration_min + real address labels onto the job
        ↓
Logistics dashboard / map tab shows: route, distance, rate, and ETA
```

---

## 2. File ownership map — who this touches

| File | Ownership | Notes |
|---|---|---|
| `src/services/geocode.ts` (new) | **Yours — new file** | No one else needs to touch it |
| `geocode_cache` SQL (new) | **Yours — new file, additive** | Share it with the team the same way you shared `logistics_seed.sql` |
| `server/api/users/me.ts` | **Shared** — used at every signup | Small, additive change (auto-geocode if lat/long missing); flag it before merging |
| `server/api/transactions/$id/estimate.ts` | **Shared** — buyer/seller "Estimate & Commit" step | Additive (save a field that's already computed); low risk but not solely yours |
| `server/api/transactions/$id/commit.ts` | **Shared** — same step | Fixes a real bug (missing fields on insert); flag it, it benefits everyone |
| `src/services/distanceMatrix.ts` | **Shared**, but only *you* call it from the map/logistics view | Optional accuracy upgrade (OSRM), same function signature, safe drop-in |
| `src/lib/useJobs.ts`, `logistics.tsx`, `map.$id.tsx` | **Yours — logistics only** | Confirmed earlier: no other role imports these |

Send teammates a short heads-up before merging anything in the "Shared" rows — same principle as before: keep function signatures and table columns purely additive so nobody else's code has to change.

---

## 3. SQL to share with the team (new file: `geocode_and_eta_migration.sql`)

```sql
-- Cache for free geocoding lookups (Nominatim/OpenStreetMap has a 1 req/sec
-- limit, so caching identical address strings avoids hammering it and keeps
-- the demo fast).
create table if not exists geocode_cache (
  id uuid primary key default gen_random_uuid(),
  query text unique not null,
  lat double precision not null,
  long double precision not null,
  cached_at timestamptz not null default now()
);

-- Additive columns to carry the ETA through, all nullable so nothing
-- existing breaks.
alter table transactions add column if not exists duration_min numeric;
alter table jobs add column if not exists duration_min numeric;
```

Run this in Supabase → SQL editor, same as your existing seed-script workflow. Purely additive, so it's safe even if someone runs it twice.

---

## 4. Antigravity prompts, in order

### Prompt 1 — free geocoding service (new file, zero conflict risk)
```
Context: This project has no way to turn a free-text address into
coordinates. users.address is captured at signup but lat/long are never
set. Add a free, keyless geocoding service using OpenStreetMap's Nominatim
API (https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1).

Task: Create src/services/geocode.ts exporting:
  export async function geocodeAddress(address: string): Promise<{ lat: number; long: number } | null>
It should:
1. Check the `geocode_cache` table (via supabaseAdmin) for an exact match
   on the normalized (trimmed, lowercased) address string first.
2. If cached, return { lat, long } immediately.
3. If not cached, call Nominatim with a descriptive User-Agent header (per
   Nominatim's usage policy — required, e.g. "circular-packaging-exchange/1.0"),
   parse the first result's lat/lon, insert it into geocode_cache, and
   return it.
4. If Nominatim returns no results or errors, return null (callers must
   handle this gracefully — don't throw).

Constraints:
- No API key, no new paid dependency.
- Follow the same supabaseAdmin usage pattern as src/services/distanceMatrix.ts.
- This is a brand new file — don't modify any existing file in this prompt.

Acceptance criteria: geocodeAddress("some real address") returns a
plausible { lat, long }; a second call with the same address hits the
cache (verify via a console log or by checking geocode_cache row count
doesn't grow).
```

### Prompt 2 — auto-geocode on signup (shared file, additive only)
```
Context: server/api/users/me.ts already accepts optional lat/long in its
POST body, defaulting to null when not provided. The signup form only ever
sends { name, role, address } — never lat/long — so every user ends up
with null coordinates. src/services/geocode.ts (from Prompt 1) exports
geocodeAddress(address).

Task: In the POST handler of server/api/users/me.ts, if `lat` or `long`
are not provided in the request body but `address` is, call
`geocodeAddress(address)` and use its result for the lat/long fields being
upserted. If geocoding fails (returns null), fall back to the existing
behavior (store null) — do not throw an error and block signup.

Constraints:
- Do not change the request/response shape — a caller that already sends
  lat/long explicitly (e.g. a future map-picker UI) must have that value
  respected, not overridden by geocoding.
- Do not touch src/routes/auth.tsx — no frontend change needed for this.
- Do not touch the GET handler in this file.

Acceptance criteria: signing up with only an address now results in a
non-null lat/long on the user row; signing up with an explicit lat/long
still uses those values as-is.
```

### Prompt 3 — stop dropping the ETA (shared file, additive only)
```
Context: server/api/transactions/$id/estimate.ts computes total_duration_min
but the final `.update()` call only saves { distance_km, estimated_cost,
status }. Add duration_min to the same update, now that the transactions
table has a duration_min column (migration already applied).

Task: In estimate.ts, add `duration_min: total_duration_min` to the
`.update(...)` payload sent to the `transactions` table. Also include
`duration_min` in the function's final returned object (it's already
computed, just also persist it).

Constraints:
- This is a one-line addition to an existing update call — don't
  restructure the rest of the function.
- Don't change how distance or cost are calculated.

Acceptance criteria: after calling estimate, the transaction row in
Supabase has a non-null duration_min matching the value returned in the
API response.
```

### Prompt 4 — fix job creation: real ETA + real address labels (shared file)
```
Context: server/api/transactions/$id/commit.ts inserts a new row into
`jobs` but never sets pickup_location, dropoff_location, or duration_min,
even though transaction.duration_min now exists (Prompt 3) and buyer.address
already exists. jobs.duration_min column exists (migration already applied).

Task: In the `jobs` insert in commit.ts, add:
- duration_min: transaction.duration_min
- dropoff_location: buyer.address
- pickup_location: for the non-bulk-lot path, use the seller's address if
  available on the listing (listing.address, only if that field exists —
  check first); if there is no address field on listings yet, fall back to
  a formatted string like `${listing.pickup_lat}, ${listing.pickup_long}`
  so the field is never left undefined. For the bulk-lot path, use a
  generic label like "Multiple pickup locations" since there are several
  sellers.

Constraints:
- Don't change any other field in the insert.
- Don't fail the commit if an address is missing — always fall back to a
  coordinate-based string rather than leaving the field undefined.

Acceptance criteria: every newly created job has non-empty, human-readable
(or coordinate-fallback) pickup_location and dropoff_location strings, and
a populated duration_min.
```

### Prompt 5 — surface ETA on your dashboard (logistics-only, safe)
```
Context: src/lib/useJobs.ts's Job interface and formatJob() currently
expose distance_km, estimated_cost (as `payout`), and a `detail` string,
but not duration_min, which now exists on the jobs table (Prompts 3-4).

Task: Add `duration_min: number | null` to the Job interface, map it in
formatJob() the same way distance_km is handled, and add a computed `eta`
display field, e.g.: `eta: duration_min ? `~${Math.round(duration_min)} min` : "ETA unavailable"`.
Then show `job.eta` on both the job card in src/routes/dashboard/logistics.tsx
(next to the existing detail/payout row) and on the map page in
src/routes/dashboard/map.$id.tsx.

Constraints:
- Only edit useJobs.ts, logistics.tsx, and map.$id.tsx — all logistics-only
  files, safe to change freely.
- Don't touch the Realtime subscription or claim/deliver logic.

Acceptance criteria: every job card and the map detail page shows an ETA
alongside the existing distance and payout.
```

### Prompt 6 (optional accuracy upgrade) — free real-road ETA instead of the flat-speed guess
```
Context: src/services/distanceMatrix.ts falls back to a straight-line
distance × 1.3 heuristic with an assumed 50 km/h speed when no Google Maps
key is set. OSRM's public routing server gives real road-network distance
and duration for free, with no API key.

Task: In the fallback path of getDistance() (the branch that currently
calls fallbackDistance()), first try calling OSRM:
`https://router.project-osrm.org/route/v1/driving/{originLong},{originLat};{destLong},{destLat}?overview=false`
Parse `routes[0].distance` (meters) and `routes[0].duration` (seconds) into
distance_km/duration_min, cache the result the same way the Google branch
does, and only fall back to the existing haversine estimate if the OSRM
call itself fails or times out.

Constraints:
- Keep the function's name, signature, and return shape exactly the same
  — every existing caller (estimate.ts, bulk lot logic) must keep working
  unmodified.
- Don't remove the haversine fallback — keep it as the final safety net if
  OSRM is unreachable (e.g. no internet during judging, or rate-limited).

Acceptance criteria: getDistance() now returns real road-based
distance/duration by default, with identical behavior for every existing
caller, and still works offline-safe via the haversine fallback.
```

---

## 5. Suggested order to actually do this in

1. Run the SQL (section 3) yourself, share the file with the team.
2. Prompts 1–2 (geocoding + signup) — do these first so real coordinates exist to test everything else against.
3. Prompts 3–4 (persist ETA, fix job labels) — flag both to your team before merging since they touch `estimate.ts`/`commit.ts`.
4. Prompt 5 (show it on your dashboard) — fully yours, no coordination needed.
5. Prompt 6 (OSRM accuracy upgrade) — nice-to-have, do it last and as its own commit so it's easy to revert if the public OSRM server misbehaves during the demo.
