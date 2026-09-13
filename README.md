# ReRoute

**Where does your packaging waste go?**

ReRoute is a B2B circular packaging & materials exchange — a marketplace that connects manufacturers and retailers who generate surplus packaging waste with recyclers and processors who need it, plus a logistics layer to actually move the material.

Built by **Team SegFaults** for **Hackout '26** (Theme: Circular Carbon Ecosystem).

---

## Official Problem Statement

> Manufacturing and retail industries generate large volumes of packaging waste, much of which could be reused or recycled if better matched between businesses. This problem involves building a B2B exchange platform where companies can list surplus or recyclable packaging materials (cardboard, plastics, pallets) for other businesses to claim or purchase, reducing landfill waste and virgin material use.

**Users:** Manufacturers, retailers, packaging recyclers, logistics companies.

**Impact:**
- Reduces packaging waste sent to landfill
- Lowers material costs for businesses adopting recycled inputs
- Cuts embodied carbon associated with virgin material production

---

## What's Built

ReRoute has three role-based dashboards, all live in the prototype:

### Seller Hub
- Post and manage material listings (type, grade, quantity, price)
- Track incoming buyer requests through approval and dispatch
- **Price decay & fallback clocks** — listings decay toward a floor price over time; at 80% decay they automatically join a nearby bulk pool, and at the floor a fixed recycler takes over automatically, so sellers always have a guaranteed exit path
- Wages & Earnings dashboard — real-time settlement ledger (today's/monthly/lifetime earnings, revenue by material)

### Marketplace (Buyer)
- Browse and filter live lots by material, grade, quantity, and pickup radius
- **Bulk Material Pools** — near-floor listings from multiple sellers automatically combine into one purchasable lot at a flat bulk rate; buying one triggers a single multi-stop logistics route across all contributing sellers
- **Requests & Exchange Orders** — track reservations, active shipments, and verified landfill diversion impact in real time
- Escrow-backed settlement — funds release once delivery is confirmed

### Logistics
- Centralized job board: Available / Assigned / In Transit / Delivered
- Each job shows route, distance, estimated duration, and carrier payout
- Multi-seller waypoint routing for consolidated bulk-pool pickups
- Wages & Payouts dashboard — earnings by route tier (local vs. long-haul)

### Circular Impact
- CO2e avoided (EPA WARM emission factors), kg diverted from landfill, combined cost savings
- Network-wide stats: waste generators, buyers, logistics partners, completed exchanges

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Start / TanStack Router, Vite, Tailwind CSS v4 |
| UI Components | Radix UI (shadcn-style), Recharts, Leaflet / react-leaflet |
| Backend | Node.js, Express 5 |
| Database & Auth | Supabase |
| Geocoding | OpenStreetMap Nominatim (free, cached in `geocode_cache`) |
| Distance / ETA | Free OSRM road-network routing by default, with an optional Google Distance Matrix upgrade path (used automatically if a key is configured), and a straight-line (haversine) estimate as a last-resort fallback |

The routing stack is deliberately keyless-first: the whole distance/ETA pipeline works out of the box with no paid API keys, and results are cached to avoid rate limits.

---

## Repo Structure

```
HackOut26/
├── backend/            # Express API (Node.js)
│   ├── routes/         # sharedRoutes, buyerRoutes, etc.
│   ├── services/       # geocode, distance matrix, pricing logic
│   └── index.js        # entry point (port 4000 by default)
├── frontend_design/    # React + TanStack Start app
│   └── src/
│       ├── routes/     # seller, buyer, logistics dashboards
│       ├── services/   # geocode.ts, distanceMatrix.ts
│       └── lib/
└── package.json        # monorepo root scripts
```

---

## Getting Started

### Prerequisites
- Node.js (LTS recommended)
- A [Supabase](https://supabase.com) project (URL + anon key + service role key)

### Install

```bash
npm run install:all
```

This installs the root, `backend`, and `frontend_design` dependencies in one go.

### Environment Variables

Create a `.env` file in `frontend_design/` (and mirror the server-only values in `backend/` as needed):

```env
# Public (exposed to browser via VITE_ prefix)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Server-only (NEVER exposed to browser)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Pricing / Decay (all have sensible defaults — only override if needed)
COST_PER_KM=0.75
DECAY_WINDOW_SECONDS=604800
DECAY_FLOOR_PCT=0.4
RECYCLER_FALLBACK_TIMEOUT_SECONDS=172800

# Bulk Batching
BATCH_ELIGIBLE_DECAY_PCT=0.8
BATCH_MATCH_RADIUS_KM=50
BATCH_MIN_ITEMS=2
BATCH_MAX_ITEMS=10
BATCH_FORMING_TIMEOUT_SECONDS=259200
```

### Run in development

```bash
npm run dev
```

This runs the backend (`http://localhost:4000`) and frontend (Vite dev server) concurrently.

Or run them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

### Build for production

```bash
npm run build
```

### Health check

Once the backend is running:

```
GET http://localhost:4000/api/health
```

---

## Database

Core Supabase tables:

- **users** — company profiles with role: manufacturer, retailer, recycler, or logistics
- **listings** — material inventory (type, grade, contamination %, quantity, price)
- **jobs** — logistics tasks with pickup/dropoff locations and status tracking
- **distance_cache** / **geocode_cache** — cached lookups to minimize external API calls and reduce latency

---

## Team

**SegFaults** — Hackout '26

## Contributions

| Contributor | Focus |
|---|---|
| Het Thakkar | Buyer's Dashboard |
| Dhvanit Chauhan | Seller's Dashboard |
| Manav Chauhan | Logistics Dashboard |
| Krishiv Sheth | Base + Research + PPT |
