# MISSION
Build the frontend for "Circular Packaging & Materials Exchange" — a B2B marketplace connecting waste-generating businesses (sellers), material buyers, and logistics companies. React + Tailwind CSS, built against the backend API contract below exactly (the backend is built separately from this same contract — do not invent or rename endpoints).

# TECH CONSTRAINTS
- React + Tailwind CSS. Vite for tooling unless you have a strong reason otherwise.
- Auth: Supabase Auth client SDK (`@supabase/supabase-js`) directly for signup/login/session; all other data access goes through the backend REST API (below), not directly against Supabase tables, so business logic stays server-side.
- Address input: Google Places Autocomplete widget resolves address → lat/long **client-side**; send the resolved lat/long to the backend. The backend does not geocode.
- Realtime notifications: subscribe directly to Supabase Realtime (`postgres_changes` on the `notifications` table, filtered to the current user's id) for live updates — don't poll.
- Visual identity: carry the same palette as the pitch deck for consistency between pitch and live demo — deep forest green primary (#1F4E3D), moss green secondary (#8FB996), amber accent (#D98E2B), Cambria/serif for headings, clean sans-serif body. Avoid generic default Tailwind blue/gray theming.

# ENVIRONMENT VARIABLES
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=              # backend REST API base
VITE_GOOGLE_MAPS_API_KEY=       # client-restricted, Places Autocomplete only
```

# API CONTRACT (build against this exactly — matches the backend agent's build)
| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | /api/users/me | yes | `{name, role, address, lat, long}` | complete profile after Supabase signup |
| GET | /api/users/me | yes | — | current profile |
| POST | /api/listings | yes (seller) | `{material_type, sub_grade, contamination_pct, quantity, unit, condition, photo_url, list_price, price_floor, pickup_lat, pickup_long}` | |
| GET | /api/listings | no | query: `material_type, max_distance_km, buyer_lat, buyer_long, min_quantity` | returns computed `current_price` per item |
| GET | /api/listings/:id | no | — | detail view |
| PATCH | /api/listings/:id | yes (owner) | partial fields | only while `open` |
| POST | /api/listings/:id/requests | yes (buyer) | — | creates `pending` request |
| PATCH | /api/requests/:id | yes (seller) | `{status: accepted\|declined}` | |
| POST | /api/transactions/:id/estimate | yes | — | returns distance_km, estimated_cost |
| POST | /api/transactions/:id/commit | yes | — | creates the logistics job |
| GET | /api/jobs | yes (logistics) | query: `status, lat, long` | proximity-sorted list |
| POST | /api/jobs/:id/claim | yes (logistics) | — | |
| POST | /api/jobs/:id/deliver | yes (assigned logistics co.) | — | |
| GET | /api/notifications | yes | — | (also live via Realtime, see above) |
| PATCH | /api/notifications/:id/read | yes | — | |
| GET | /api/impact/summary | yes | — | kg diverted, co2e avoided, cost savings |
| POST | /api/transactions/:id/ratings | yes | `{ratee_id, rating, comment}` | `ratee_id` required for bulk transactions (rate each contributing seller separately); inferred for single-seller transactions |
| GET | /api/users/:id/ratings | no | — | list + average rating for a company, shown on their listings/profile |
| GET | /api/bulk-lots | no | query: `material_type, max_distance_km, buyer_lat, buyer_long` | open lots only, priced at `bulk_rate_per_kg * total_quantity` |
| GET | /api/bulk-lots/:id | no | — | detail; contributing seller identities are not exposed pre-purchase |
| POST | /api/bulk-lots/:id/purchase | yes (buyer) | — | only if `status='open'`; **auto-completes immediately, no seller approval** (sellers pre-consented by entering the pool); creates one `transactions` row with `bulk_lot_id` set, marks lot + all contributing listings `claimed` |

# PAGES / COMPONENTS TO BUILD
1. **Auth** — signup (role picker: manufacturer/retailer/recycler/logistics, name, address via Places Autocomplete, Supabase email/password) and login.
2. **Marketplace Feed** (buyer view) — filterable list of open listings (material_type, distance radius from the buyer's own address, min quantity); each card shows the already-decayed `current_price` returned by the API, material info, and distance. Note in a tooltip/footnote that price decays over time toward a floor for unsold listings — this is a feature, not a bug, worth surfacing rather than hiding.
3. **Listing Detail** — full listing info + "Request This" action.
4. **Seller Dashboard** — "My Listings" (create/edit, see status/current decayed price), "Incoming Requests" (accept/decline).
5. **Buyer Dashboard** — "My Requests" (status), "My Transactions" (estimate step showing distance + cost, then a commit action).
6. **Logistics Dashboard** — "Available Jobs" (open jobs sorted by proximity to their own address), "Current Job" (their assigned job, with a "Mark Delivered" action).
7. **Notifications** — bell icon + dropdown/panel, live via Realtime subscription, mark-as-read.
8. **Post-Delivery Rating Prompt** — once a transaction hits `completed`, both buyer and seller see a one-time prompt (modal or dashboard card) to rate the other party (1-5 + optional comment). Hide it once submitted; don't re-prompt.
9. **Ratings on Profiles/Listings** — show a company's average rating + count wherever they're visible to a counterparty (listing cards, seller/buyer profile) — this is the trust signal that backs up the self-declared condition/photo data.
9b. **Bulk Lots tab** (buyer-facing) — separate from the individual marketplace feed: browse open bulk lots (material, total quantity, flat rate, distance), "Purchase" action that completes immediately (no pending/accepted state to show — surface this clearly, e.g. "Buy Now" not "Request").
9c. **Bulk rating flow** — after a bulk transaction completes, the buyer's rating prompt loops through each contributing seller individually (one rating per seller), and each contributing seller separately gets a prompt to rate the buyer.
9d. **Multi-stop pickup display** (logistics dashboard) — when a claimed job has multiple stops (`job_stops`), show them as an ordered pickup list before the final dropoff, not a single address.
10. **Impact Dashboard** — aggregate kg diverted, est. CO2e avoided, cost savings (only where a price existed). Include a small, honest footnote that the CO2e figure uses a blended EPA-WARM-based average, not a material-specific factor, mirroring the same caveat the backend stores in `emission_factors.source_note` — don't let the UI imply more precision than the backend actually has.

# VERIFICATION (use your browser agent, show me the walkthrough)
1. `npm install && npm run dev`, open in the managed browser.
2. Sign up one account per role (or use the backend's seeded logins).
3. As a manufacturer: create a listing with a photo and a real price/floor.
4. As a buyer: browse, filter by material type and distance, send a request.
5. As the manufacturer: accept the request; confirm the UI advances to the estimate step.
6. Trigger the estimate, then commit; confirm a job now appears in the logistics dashboard for a seeded logistics account.
7. As logistics: claim the job, then mark it delivered.
8. Confirm both buyer and seller see a notification appear **without a page refresh** (Realtime, not polling).
9. Confirm the impact dashboard updates after delivery, including the blended-factor footnote.
9b. Confirm both buyer and seller can rate each other after delivery (and only after), that a second attempt is blocked, and that the average rating appears on the rated company's listings/profile.
9c. Using seeded stale listings (same material/sub_grade, pickup points within radius): confirm they group into an open bulk lot, a seed buyer can "Buy Now" with no approval step, the resulting job shows multiple pickup stops, delivery completes it, and the buyer is prompted to rate each contributing seller separately.
10. Screenshot each major step per your normal artifact behavior; flag anything in the contract above you had to deviate from, and why.
