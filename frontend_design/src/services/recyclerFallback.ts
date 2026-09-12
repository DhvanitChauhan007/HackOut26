import { supabaseAdmin } from "../api/supabase";
import { config } from "../api/config";
import { isAtFloorForTimeout, computeCurrentPrice } from "./priceDecay";
import { createNotification } from "./notifications";

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
  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .insert({
      request_id: requestId,
      listing_id: listing.id,
      seller_id: listing.seller_id,
      buyer_id: (acceptedRequest as { buyer_id: string }).buyer_id,
      estimated_cost: finalPrice,
      status: "pending",
    })
    .select()
    .single();

  if (txError) throw new Error(`Failed to create transaction: ${txError.message}`);

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
