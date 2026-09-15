# Circular Packaging & Materials Exchange

**Theme:** Circular Carbon Ecosystem — HackOut'26
**Team:** SegFaults

A B2B marketplace that connects waste generators, material buyers, and logistics companies to divert packaging waste (cardboard, plastics, pallets) from landfill — turning a disposal cost into a revenue stream and a supply source.

🔗 **Live demo:** [https://reroute-ochre.vercel.app/]

---

## The Problem

Manufacturing and retail generate large volumes of packaging waste with no efficient way to connect the businesses that have it with the businesses that want it. The result: reusable material goes to landfill, sellers pay disposal fees, and buyers miss out on cheaper recycled sourcing — all because there's no shared marketplace or logistics layer tying the two sides together.

## Who It's For

| Role | What they get |
|---|---|
| **Waste Generators** (manufacturers, retailers, brands) | Lower disposal costs, a channel to sell material that would otherwise be landfilled |
| **Material Buyers** (processors, packagers, recyclers) | Consistent, filterable supply without chasing fragmented sources |
| **Logistics Companies** | A live job board of pickup/delivery jobs they can claim, priced by distance |

## How It Works

**List → Match & Request → Estimate & Commit → Job Board Routing → Logistics Assignment → Delivered**

1. **List** — A seller posts a material listing: type, sub-grade, contamination %, quantity, condition photo, and pickup location.
2. **Match & Request** — Buyers filter listings by category and distance, then send a claim request. The seller accepts or declines; accepting locks the listing to prevent double-booking.
3. **Estimate & Commit** — A distance-based cost is calculated and shown before either side commits.
4. **Job Board Routing** — Once committed, the transaction becomes an open job visible to logistics companies, sorted by proximity.
5. **Logistics Assignment** — A logistics company claims the job from its dashboard; both buyer and seller are notified in real time.
6. **Delivered** — The logistics company marks the job delivered, closing the loop and logging the diverted volume and estimated CO2e avoided to an impact dashboard.

### Price Decay & Recycler Fallback

Unsold listings don't just sit indefinitely — their price decays linearly from the list price toward a floor price over a set window. As a listing nears its floor, it becomes eligible to join a bulk lot with other near-floor listings of the same material and grade, letting a buyer purchase them together in one multi-stop pickup. If a listing hits its floor without selling (alone or as part of a lot), it automatically routes to a fixed fallback recycler, guaranteeing every listing eventually gets diverted from landfill rather than expiring unresolved.

### Impact Tracking

Every completed delivery logs:
- **Environmental impact** — estimated CO2e avoided (via EPA WARM emission-factor lookups per material type)
- **Economic impact** — disposal cost avoided for the seller and material cost saved for the buyer, where pricing exists
- **Circular economy impact** — cumulative kilograms diverted from landfill over time

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | Node.js + Express |
| Database & Auth | Supabase (Postgres + built-in Auth + Realtime) |
| File Storage | Supabase Storage (listing condition photos) |
| Maps & Distance | Google Maps Distance Matrix API, with a free OSRM/haversine fallback for offline-safe estimates |
| Notifications | Supabase Realtime subscriptions (no polling) |
| Deployment | Docker containerization; frontend deployed on Vercel |

## Repository Structure

```
HackOut26/
├── backend/            # Node.js + Express API, Supabase integration
├── frontend_design/    # React + Tailwind CSS frontend
├── circular_packaging_exchange_plan.md      # Product plan: users, data model, MVP scope
├── address-distance-rate-eta-workflow.md    # Distance/rate/ETA implementation workflow
├── antigravity_backend_prompt.md
├── antigravity_frontend_prompt.md
└── package.json        # Monorepo root scripts (runs backend + frontend together)
```

## Key Features (MVP)

- Company signup/login with role selection (manufacturer, retailer, recycler, logistics)
- Create, browse, and filter listings by material, sub-grade, distance, and quantity
- Request → accept/decline workflow with listing locks to prevent double-booking
- Distance-based cost estimation via Google Maps Distance Matrix, with caching
- Logistics dashboard: proximity-sorted open jobs → claim → mark delivered, with live ETA
- Real-time in-app notifications at job assignment and delivery
- Impact dashboard: kilograms diverted, estimated CO2e avoided, and cost savings
- Condition photo upload for listings
- Price decay with automatic fixed-recycler fallback for unsold listings
- Cross-seller bulk batching for stale, near-floor listings
- Two-way buyer ↔ seller ratings, shown as a trust signal on profiles and listings

## Stretch Goals (Not in MVP)

- In-app negotiation/chat between buyers and sellers
- Full multi-stop route optimization (VRP-style) for logistics, beyond proximity sorting
- Regulated-material compliance flags
- Photo-based automated condition verification (computer vision)
- Gamified badges for consistent diverters

---

Built by **Team SegFaults** for HackOut'26.
