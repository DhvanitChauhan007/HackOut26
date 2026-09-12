# ReLoop Exchange UI Mockup

## Goal
Build a polished, responsive, clickable mockup of the circular packaging marketplace using the selected playful industrial direction and realistic seeded data from the uploaded plan.

## Screens and interactions
- Create the signed-in marketplace dashboard as the home screen.
- Add role switching for Buyer, Seller, and Logistics views.
- Add working navigation between Browse, Listings, Logistics, Bulk Lots, Impact, and Notifications.
- Make material filters, distance range, and listing requests interactive.
- Show a listing detail panel with price decay, freight estimate, seller rating, and request confirmation.
- Include seller accept/decline states, logistics claim/delivered states, bulk batching, recycler fallback, notifications, and impact metrics.
- Use local mock state only; no accounts, database, maps service, or uploads will be connected.

## Visual direction
- Carry over the selected warm paper, pine green, lime, coral, sun yellow, and sky blue palette.
- Use Fredoka for expressive headings and Space Grotesk for interface text.
- Preserve the rounded industrial dashboard composition, bold status labels, compact data, and playful tactile controls.
- Adapt the layout for mobile without losing key actions or readable data.

## Technical details
- Implement the mockup in the existing TanStack Start home route.
- Define all colors, fonts, shadows, and reusable visual styles as semantic tokens in the global stylesheet.
- Load fonts through the document head and add complete page metadata.
- Verify interactions and layout in the running preview at desktop and mobile sizes.
