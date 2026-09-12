# Circular Packaging & Materials Exchange — Final Plan

**Theme:** Circular Carbon Ecosystem (HackOut'26) · **Team:** SegFaults
**One-liner:** A B2B marketplace connecting waste generators, material buyers, and logistics companies to divert packaging waste from landfill.

## Problem
Manufacturing and retail generate large volumes of packaging waste (cardboard, plastics, pallets) with no efficient mechanism to connect waste generators with buyers. Result: reusable material goes to landfill, businesses pay disposal fees *and* miss cost savings from recycled sourcing.

## Users
- **Waste Generators** (manufacturers, retailers, brands) — reduce disposal costs, source cheaper recycled materials
- **Material Buyers** (processors, packagers, recyclers) — consistent supply without fragmented sourcing
- **Logistics Companies** — claim pickup/delivery jobs from a centralized dashboard

## Decided Tech Stack
| Layer | Technology | Status |
|---|---|---|
| Frontend | React + Tailwind CSS | Confirmed |
| Backend | Node.js + Express | **Assumed default** — confirm or override |
| Database & Auth | Supabase (Postgres + built-in Auth + Realtime) | Confirmed |
| Storage | Supabase Storage (listing condition photos) | **Added — gap in original deck** |
| Maps/Logistics | Google Maps Distance Matrix API (driving distance) | Confirmed |
| Notifications | Supabase Realtime subscriptions (not manual polling) | Confirmed |
| Deployment | Docker containerization | Confirmed |

## Data Model
- **users** — company profile: name, role (`manufacturer` / `retailer` / `recycler` / `logistics`), address, lat/long. One seeded account flagged `is_fixed_recycler=true` — always auto-accepts (the guaranteed-offtake fallback).
- **listings** — seller_id, material_type, sub_grade, contamination_pct, quantity, condition, photo_url, `list_price`, `price_floor`, `decay_window` (time to reach floor), pickup lat/long, status (`open` / `claimed` / `completed`). Current price computed at read-time: `list_price - (elapsed / decay_window) x (list_price - price_floor)`, clamped at floor. No scheduler needed.
- **requests** — listing_id, buyer_id, status (`pending` / `accepted` / `declined`)
- **jobs** — transaction_id, logistics_company_id (nullable until claimed), pickup_location, dropoff_location, distance_km, estimated_cost, status (`open` / `assigned` / `delivered`)
- **distance_cache** — origin, destination, distance_km, duration, cached_at (avoids repeat Google Maps billing)
- **notifications** — user_id, message, read, created_at (or Supabase Realtime channel events)

## Core Transaction Flow
**List → Match & Request → Estimate & Commit → Job Board Routing → Logistics Assignment → Delivered**

1. **List** — Seller posts material type, sub-grade, contamination %, quantity, condition photo, location.
2. **Match & Request** — Buyer filters by category + distance; sends a claim request. Seller accepts/declines. Accepting locks the listing (prevents double-booking) and creates a transaction.
3. **Estimate & Commit** — Distance-based cost shown via Google Distance Matrix (cached); buyer/seller commit.
4. **Job Board Routing** — Transaction becomes an open job (pickup = seller, drop-off = buyer), visible to logistics companies, sorted by proximity to each logistics company (simple sort — not full route optimization).
5. **Logistics Assignment** — A logistics company claims the job from their dashboard. Job locks to `assigned`. **Notification: buyer + seller informed a carrier is assigned.**
6. **Delivered** — Logistics company marks the job "Delivered" from their dashboard. **Notification: buyer informed the product has arrived; seller informed delivery is confirmed complete.** Diverted volume + CO2e logged to the impact dashboard.

### Price Decay -> Bulk Batching -> Recycler Fallback (unsold listings, full funnel)
1. Listing sits unclaimed; price decays linearly from `list_price` toward `price_floor`.
2. **Once decay crosses ~80% of the way to floor (still above floor)**, the listing becomes batch-eligible. The system looks for a `forming` bulk lot of the same material_type + sub_grade within a matching radius; joins it, or starts a new one. A lot opens (becomes purchasable) once it reaches a minimum item count. Entering the pool = implicit seller pre-consent to a bulk sale at the flat per-kg rate — **no per-seller approval step**, since no single seller has authority to approve on behalf of the others.
3. A buyer can purchase an open bulk lot directly (auto-completes immediately, unlike normal listings). This creates a multi-stop logistics job (one pickup per contributing seller, one dropoff at the buyer).
4. **Independently of batching**, each listing's own decay/recycler-fallback clock keeps running. If a listing hits full floor + fallback timeout before its bulk lot sells, it's pulled out of the lot and routed to the fixed recycler on its own — batching and recycler-fallback don't block each other; whichever resolves first wins for a given listing.
5. If a `forming` lot never reaches minimum size before its own timeout, it dissolves and members fall back to their individual timelines.

**Fallback if cross-seller batching doesn't fit the build window:** downgrade to same-seller batching only (a seller's own stale listings merge into one bigger listing) — no multi-stop logistics, no multi-seller rating/settlement complexity. Document this as the graceful-degradation path rather than cutting the feature entirely.

**Demo note:** real day-based decay is invisible in a live judging slot. Seed/demo listings should use a compressed decay window (minutes, not days) so the decay -> recycler handoff is actually visible on stage; production listings would use a realistic window (days).

> Notification direction was previously ambiguous — resolved here as: assignment → notifies both parties; delivery → buyer told they received it, seller told it was delivered. Flag if this isn't the intended direction.

## Cold-Start / Demo Strategy
- Seed company profiles flagged `is_seed=true` for easy filtering.
- Seed accounts auto-accept requests during a live demo (no waiting).
- **Caveat:** this makes the *demo* look live. It is not a real cold-start solution for an actual launch — don't present it as one if asked in Q&A.

## Impact Calculation
- **Environmental**: CO2e avoided via EPA WARM emission-factor lookup table, per material type, applied on delivery.
- **Economic**: disposal-cost-avoided (seller) and material-cost-saved (buyer) — only computable if listings carry a price/valuation field; free listings won't produce a cost-saving number, only a diversion/CO2e number.
- **Circular economy**: cumulative kg diverted from landfill, tracked over time.

## MVP Feature Scope (Must-Have)
- Company signup/login (Supabase Auth), role selection
- Create/browse/filter listings (material, sub-grade, distance, quantity)
- Request → accept/decline workflow with locking
- Distance-based cost estimate (Google Distance Matrix + cache)
- Logistics dashboard: open jobs (proximity-sorted) → claim → mark delivered
- Realtime in-app notifications at assignment + delivery
- Impact dashboard: kg diverted, est. CO2e avoided, cost savings (where price exists)
- Condition photo upload (Supabase Storage)
- Seed data + auto-accept for demo reliability
- Price decay (read-time computed, no scheduler) + fixed-recycler auto-fallback for unsold listings
- Two-way rating (buyer <-> seller) unlocked after a transaction completes; average rating shown on profiles/listings as a trust signal
- Cross-seller bulk batching for stale near-floor listings, with same-seller-only as the documented fallback scope if time runs short
- Compressed decay window for demo/seed listings so the fallback is visible live

## Stretch (Not MVP)
- In-app negotiation/chat
- Real multi-stop route optimization (VRP-style) for logistics
- Regulated-material compliance flags
- Photo-based automated condition verification (CV)
- Gamified badges

## Open Items Before Writing Build Prompts
1. Confirm backend framework (Node/Express assumed) — or actually Python/FastAPI.
2. Confirm route-optimization scope (proximity sort assumed) vs. real routing.
3. Confirm notification direction as resolved above.
4. **Which agent/tool will consume the build prompts?** (Claude Code, Lovable, Cursor, v0/Bolt, other) — prompt structure differs a lot by target: a single conversational spec (Lovable-style) vs. task-scoped engineering instructions (Claude Code-style) vs. component-by-component specs (v0-style). Needed before I write the backend/frontend prompts.
