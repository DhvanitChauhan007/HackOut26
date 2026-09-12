# Split Marketplace and Logistics Dashboards

## Goal
Reorganize ReLoop into two clear workspaces: one dashboard for buying and selling materials, and one dashboard for logistics operations.

## Dashboard 1: Buy or Sell
- Use a prominent Buy/Sell mode switch within the marketplace dashboard.
- Buyer mode keeps matched lots, filters, lot details, reservations, bulk lots, and impact information.
- Seller mode focuses on active material listings, incoming requests, pricing, fallback timing, and listing actions.
- Remove Logistics from the marketplace role switch so the two workspaces stay distinct.

## Dashboard 2: Logistics
- Give logistics its own dashboard entry and focused heading.
- Show available, assigned, in-transit, and delivered jobs in the compact industrial card style.
- Keep claim and delivery actions working without requiring a separate role switch.
- Include route, load, distance, payout, and delivery status at a glance.

## Shared experience
- Add a clear top-level switch between Marketplace and Logistics.
- Preserve notifications, mobile navigation, seeded mock data, and existing interactive states.
- Keep the current playful industrial palette, typography, imagery, and responsive layout.

## Technical details
- Continue using local mock state only; no accounts, maps, or database will be added.
- Refactor the existing home screen state and components rather than creating duplicate app shells.
- Verify both dashboards and their actions at desktop and mobile sizes.
