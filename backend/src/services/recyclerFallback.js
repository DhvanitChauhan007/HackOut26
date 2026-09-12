const supabase = require('../supabaseClient');
const config = require('../config');
const { isAtFloorForTimeout, computeCurrentPrice } = require('./priceDecay');
const { createNotification } = require('./notifications');

// ---------------------------------------------------------------------------
// Reusable accept-request logic
// ---------------------------------------------------------------------------

/**
 * Accept a request: lock the listing to 'claimed', auto-decline every other
 * pending request for the same listing, and create a transaction row.
 *
 * Designed to be called both from the PATCH /api/requests/:id route AND from
 * the recycler-fallback path so business logic is never forked.
 *
 * @param {string} requestId — the request row id to accept
 * @param {object} listing   — full listing row (must include id, seller_id, material_type, quantity_kg)
 * @returns {Promise<{ transaction: object, request: object }>}
 */
async function acceptRequest(requestId, listing) {
  // 1. Mark the request as accepted
  const { data: acceptedRequest, error: reqError } = await supabase
    .from('requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .select()
    .single();

  if (reqError) throw new Error(`Failed to accept request: ${reqError.message}`);

  // 2. Lock the listing → 'claimed'
  const { error: listingError } = await supabase
    .from('listings')
    .update({ status: 'claimed' })
    .eq('id', listing.id);

  if (listingError) throw new Error(`Failed to lock listing: ${listingError.message}`);

  // 3. Decline every other pending request for this listing
  const { data: declinedRequests, error: declineError } = await supabase
    .from('requests')
    .update({ status: 'declined' })
    .eq('listing_id', listing.id)
    .eq('status', 'pending')
    .neq('id', requestId)
    .select();

  if (declineError) {
    console.error('Failed to decline other requests:', declineError);
  }

  // 4. Compute the final price at time of acceptance
  const finalPrice = computeCurrentPrice(listing);

  // 5. Create a transaction row
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      request_id: requestId,
      listing_id: listing.id,
      seller_id: listing.seller_id,
      buyer_id: acceptedRequest.buyer_id,
      estimated_cost: finalPrice,
      status: 'pending',
    })
    .select()
    .single();

  if (txError) throw new Error(`Failed to create transaction: ${txError.message}`);

  // 6. Notify the accepted buyer
  await createNotification(
    acceptedRequest.buyer_id,
    `Your request for listing "${listing.title || listing.id}" has been accepted.`,
    'request_accepted',
  );

  // 7. Notify the seller
  await createNotification(
    listing.seller_id,
    `A request for your listing "${listing.title || listing.id}" has been accepted.`,
    'request_accepted',
  );

  // 8. Notify declined buyers (best-effort, don't throw)
  if (declinedRequests && declinedRequests.length > 0) {
    await Promise.allSettled(
      declinedRequests.map((r) =>
        createNotification(
          r.buyer_id,
          `Your request for listing "${listing.title || listing.id}" has been declined.`,
          'request_declined',
        ),
      ),
    );
  }

  return { transaction, request: acceptedRequest };
}

// ---------------------------------------------------------------------------
// Recycler-fallback check (evaluated lazily on listing reads)
// ---------------------------------------------------------------------------

/**
 * Check if a listing qualifies for the recycler fallback and, if so,
 * auto-create a request from the fixed recycler account and accept it.
 *
 * Conditions — all must be true:
 *   1. listing.status === 'open'
 *   2. Price has been at the floor for >= RECYCLER_FALLBACK_TIMEOUT_SECONDS
 *   3. No accepted request already exists for this listing
 *
 * @param {object} listing — full listing row from DB
 * @returns {Promise<object>} the listing, possibly with status updated to 'claimed'
 */
async function checkAndTriggerFallback(listing) {
  // Condition 1: must be open
  if (listing.status !== 'open') return listing;

  // Condition 2: price at floor long enough
  if (!isAtFloorForTimeout(listing, config.RECYCLER_FALLBACK_TIMEOUT_SECONDS)) {
    return listing;
  }

  // Condition 3: no accepted request already exists
  const { data: existingAccepted, error: acceptedErr } = await supabase
    .from('requests')
    .select('id')
    .eq('listing_id', listing.id)
    .eq('status', 'accepted')
    .limit(1);

  if (acceptedErr) {
    console.error('Recycler fallback — accepted-request check failed:', acceptedErr);
    return listing;
  }

  if (existingAccepted && existingAccepted.length > 0) return listing;

  // --- All conditions met — trigger fallback ---

  // Find the fixed recycler account
  const { data: recycler, error: recyclerErr } = await supabase
    .from('users')
    .select('id')
    .eq('is_fixed_recycler', true)
    .limit(1)
    .single();

  if (recyclerErr || !recycler) {
    console.error('Recycler fallback — no fixed recycler account found:', recyclerErr);
    return listing;
  }

  // Create a request from the recycler
  const { data: newRequest, error: reqInsertErr } = await supabase
    .from('requests')
    .insert({
      listing_id: listing.id,
      buyer_id: recycler.id,
      status: 'pending',
    })
    .select()
    .single();

  if (reqInsertErr) {
    console.error('Recycler fallback — request insert failed:', reqInsertErr);
    return listing;
  }

  // Accept the request through the shared accept logic
  try {
    await acceptRequest(newRequest.id, listing);
  } catch (err) {
    console.error('Recycler fallback — accept failed:', err);
    return listing;
  }

  // Notify the seller that the listing fell back to the recycler
  await createNotification(
    listing.seller_id,
    `Your listing "${listing.title || listing.id}" was not claimed in time and has been routed to the recycler.`,
    'recycler_fallback',
  );

  // Return the listing with the updated status so the caller sees 'claimed'
  return { ...listing, status: 'claimed' };
}

module.exports = { checkAndTriggerFallback, acceptRequest };
