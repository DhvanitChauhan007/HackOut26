import { supabaseAdmin } from "../api/supabase";
import { config } from "../api/config";
import { isAtFloorForTimeout, computeCurrentPrice } from "./priceDecay";
import { createNotification } from "./notifications";
import { getDistance } from "./distanceMatrix";

export interface Listing {
  id: string;
  seller_id: string;
  status: string;
  title?: string;
  list_price: number;
  price_floor: number;
  decay_window_seconds: number;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Accept a request: lock the listing to 'claimed', auto-decline every other
 * pending request for the same listing, and create a transaction row.
 * Mirrors backend/src/services/recyclerFallback.js acceptRequest.
 */
export async function acceptRequest(
  requestId: string,
  listing: Listing
): Promise<{ transaction: unknown; request: unknown }> {
  // 1. Mark the request as accepted
  const { data: acceptedRequest, error: reqError } = await supabaseAdmin
    .from("requests")
    .update({ status: "accepted" })
    .eq("id", requestId)
    .select()
    .single();

  if (reqError) throw new Error(`Failed to accept request: ${reqError.message}`);

  // 2. Lock the listing → 'claimed'
  const { error: listingError } = await supabaseAdmin
    .from("listings")
    .update({ status: "claimed" })
    .eq("id", listing.id);

  if (listingError) throw new Error(`Failed to lock listing: ${listingError.message}`);

  // 3. Decline every other pending request for this listing
  const { data: declinedRequests, error: declineError } = await supabaseAdmin
    .from("requests")
    .update({ status: "declined" })
    .eq("listing_id", listing.id)
    .eq("status", "pending")
    .neq("id", requestId)
    .select();

  if (declineError) console.error("Failed to decline other requests:", declineError);

  // 4. Compute the final price at time of acceptance
  const finalPrice = computeCurrentPrice(listing);

  // 5. Create a transaction row
  const qtyKg = Number(listing["quantity"]) || 1000;
  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .insert({
      request_id: requestId,
      listing_id: listing.id,
      seller_id: listing.seller_id,
      buyer_id: (acceptedRequest as { buyer_id: string }).buyer_id,
      estimated_cost: finalPrice,
      status: "pending",
      impact_kg_diverted: qtyKg,
      impact_co2e_kg: Math.round(qtyKg * 3.12 * 10) / 10,
    })
    .select()
    .single();

  if (txError) throw new Error(`Failed to create transaction: ${txError.message}`);

  // ─── Auto-estimate + auto-commit ────────────────────────────────────────────
  // Chain the estimate → commit steps automatically so a job appears on the
  // logistics dashboard the instant the seller approves. Both steps are
  // best-effort — if coords are missing or a step fails we log and continue
  // so the transaction is never left in a broken state.
  try {
    const txId = (transaction as { id: string }).id;
    const buyerId = (acceptedRequest as { buyer_id: string }).buyer_id;

    // Fetch buyer profile for coordinates + address
    const { data: buyer } = await supabaseAdmin
      .from("users")
      .select("lat, long, address")
      .eq("id", buyerId)
      .single();

    // Fetch seller profile for coordinates + address fallback
    const { data: seller } = await supabaseAdmin
      .from("users")
      .select("lat, long, address")
      .eq("id", listing.seller_id)
      .single();

    const pickupLat = (listing["pickup_lat"] as number | null) ?? seller?.lat ?? null;
    const pickupLong = (listing["pickup_long"] as number | null) ?? seller?.long ?? null;
    const dropoffLat = buyer?.lat as number | null;
    const dropoffLong = buyer?.long as number | null;

    if (pickupLat != null && pickupLong != null && dropoffLat != null && dropoffLong != null) {
      // Step A: Compute distance + ETA
      const { distance_km, duration_min } = await getDistance(
        pickupLat, pickupLong, dropoffLat, dropoffLong
      );
      const estimated_cost = Math.round(distance_km * config.COST_PER_KM * 100) / 100;

      // Step B: Mark transaction as estimated
      await supabaseAdmin
        .from("transactions")
        .update({ distance_km, estimated_cost, duration_min, status: "estimated" })
        .eq("id", txId);

      // Step C: Derive location labels (prefer human-readable addresses)
      const pickupLocation = (listing["address"] as string | null)
        ?? (seller?.address as string | null)
        ?? `${pickupLat}, ${pickupLong}`;
      const dropoffLocation = (buyer?.address as string | null)
        ?? `${dropoffLat}, ${dropoffLong}`;

      // Step D: Insert the job row → appears immediately on logistics dashboard
      const { error: jobError } = await supabaseAdmin
        .from("jobs")
        .insert({
          transaction_id: txId,
          pickup_lat: pickupLat,
          pickup_long: pickupLong,
          pickup_location: pickupLocation,
          dropoff_lat: dropoffLat,
          dropoff_long: dropoffLong,
          dropoff_location: dropoffLocation,
          distance_km,
          duration_min,
          estimated_cost,
          status: "open",
        });

      if (jobError) {
        console.error("Auto-commit job insert error:", jobError);
      } else {
        // Step E: Mark transaction as committed
        await supabaseAdmin
          .from("transactions")
          .update({ status: "committed" })
          .eq("id", txId);
      }
    } else {
      console.warn(
        `Auto-commit skipped for transaction ${txId}: buyer or listing is missing coordinates.`
      );
    }
  } catch (autoErr) {
    // Non-fatal — the transaction exists; logistics team can be notified separately
    console.error("Auto-estimate/commit failed (non-fatal):", autoErr);
  }
  // ────────────────────────────────────────────────────────────────────────────

  // 6. Notify accepted buyer
  await createNotification(
    (acceptedRequest as { buyer_id: string }).buyer_id,
    `Your request for listing "${listing.title || listing.id}" has been accepted.`,
    "request_accepted"
  );

  // 7. Notify seller
  await createNotification(
    listing.seller_id,
    `A request for your listing "${listing.title || listing.id}" has been accepted.`,
    "request_accepted"
  );

  // 8. Notify declined buyers (best-effort)
  if (declinedRequests && declinedRequests.length > 0) {
    await Promise.allSettled(
      declinedRequests.map((r: { buyer_id: string }) =>
        createNotification(
          r.buyer_id,
          `Your request for listing "${listing.title || listing.id}" has been declined.`,
          "request_declined"
        )
      )
    );
  }

  return { transaction, request: acceptedRequest };
}

/**
 * Check if a listing qualifies for the recycler fallback and, if so,
 * auto-create a request from the fixed recycler account and accept it.
 * Mirrors backend/src/services/recyclerFallback.js checkAndTriggerFallback.
 */
export async function checkAndTriggerFallback(listing: Listing): Promise<Listing> {
  if (listing.status !== "open") return listing;

  if (!isAtFloorForTimeout(listing, config.RECYCLER_FALLBACK_TIMEOUT_SECONDS)) {
    return listing;
  }

  const { data: existingAccepted, error: acceptedErr } = await supabaseAdmin
    .from("requests")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("status", "accepted")
    .limit(1);

  if (acceptedErr) {
    console.error("Recycler fallback — accepted-request check failed:", acceptedErr);
    return listing;
  }

  if (existingAccepted && existingAccepted.length > 0) return listing;

  const { data: recycler, error: recyclerErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("is_fixed_recycler", true)
    .limit(1)
    .single();

  if (recyclerErr || !recycler) {
    console.error("Recycler fallback — no fixed recycler account found:", recyclerErr);
    return listing;
  }

  const { data: newRequest, error: reqInsertErr } = await supabaseAdmin
    .from("requests")
    .insert({ listing_id: listing.id, buyer_id: recycler.id, status: "pending" })
    .select()
    .single();

  if (reqInsertErr) {
    console.error("Recycler fallback — request insert failed:", reqInsertErr);
    return listing;
  }

  try {
    await acceptRequest((newRequest as { id: string }).id, listing);
  } catch (err) {
    console.error("Recycler fallback — accept failed:", err);
    return listing;
  }

  await createNotification(
    listing.seller_id,
    `Your listing "${listing.title || listing.id}" was not claimed in time and has been routed to the recycler.`,
    "recycler_fallback"
  );

  return { ...listing, status: "claimed" };
}
