/**
 * Cross-seller bulk batching service.
 *
 * Evaluated lazily on listing reads (same pattern as recycler fallback).
 * Groups stale listings from different sellers into bulk lots based on
 * material_type + sub_grade proximity, so buyers can purchase in bulk
 * at a discounted per-kg rate.
 */

const supabase = require('../supabaseClient');
const config = require('../config');
const { haversine } = require('../utils/haversine');
const { isBatchEligible } = require('./priceDecay');

// ---------------------------------------------------------------------------
// 1. checkBatchEligibility
// ---------------------------------------------------------------------------

/**
 * Given a listing, check if it has decayed enough to enter a bulk lot.
 * If eligible and not already batched, join an existing forming lot or
 * create a new one.
 *
 * @param {object} listing - full listing row (must include id, seller_id,
 *   material_type, sub_grade, quantity, pickup_lat, pickup_long, and the
 *   fields required by isBatchEligible: created_at, decay_window_seconds).
 * @returns {{ batched: boolean, bulk_lot_id?: string }} outcome
 */
async function checkBatchEligibility(listing) {
  // --- gate: decay threshold ---
  if (!isBatchEligible(listing, config.BATCH_ELIGIBLE_DECAY_PCT)) {
    return { batched: false };
  }

  // --- gate: already in a lot? ---
  const { data: existingItem, error: existErr } = await supabase
    .from('bulk_lot_items')
    .select('id')
    .eq('listing_id', listing.id)
    .maybeSingle();

  if (existErr) throw existErr;
  if (existingItem) return { batched: false };

  // --- try to find a forming lot to join ---
  const lot = await _findFormingLot(listing);

  if (lot) {
    return _joinLot(lot, listing);
  }

  // --- create a new lot ---
  return _createLot(listing);
}

// ---------------------------------------------------------------------------
// Internal: find a compatible forming lot within radius
// ---------------------------------------------------------------------------

async function _findFormingLot(listing) {
  const { data: candidates, error } = await supabase
    .from('bulk_lots')
    .select('*, bulk_lot_items(pickup_lat, pickup_long)')
    .eq('material_type', listing.material_type)
    .eq('sub_grade', listing.sub_grade)
    .eq('status', 'forming');

  if (error) throw error;
  if (!candidates || candidates.length === 0) return null;

  for (const lot of candidates) {
    const items = lot.bulk_lot_items || [];

    // Don't exceed max items
    if (items.length >= config.BATCH_MAX_ITEMS) continue;

    // At least one existing item must be within the match radius
    const withinRadius = items.some((item) =>
      haversine(
        listing.pickup_lat,
        listing.pickup_long,
        item.pickup_lat,
        item.pickup_long,
      ) <= config.BATCH_MATCH_RADIUS_KM,
    );

    if (withinRadius) return lot;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Internal: join an existing lot
// ---------------------------------------------------------------------------

async function _joinLot(lot, listing) {
  const { error: insertErr } = await supabase
    .from('bulk_lot_items')
    .insert({
      bulk_lot_id: lot.id,
      listing_id: listing.id,
      seller_id: listing.seller_id,
      quantity: listing.quantity,
      pickup_lat: listing.pickup_lat,
      pickup_long: listing.pickup_long,
    });

  if (insertErr) throw insertErr;

  const newTotal = (lot.total_quantity || 0) + listing.quantity;
  const newItemCount = (lot.bulk_lot_items?.length || 0) + 1;

  const updates = { total_quantity: newTotal };
  if (newItemCount >= config.BATCH_MIN_ITEMS) {
    updates.status = 'open';
  }

  const { error: updateErr } = await supabase
    .from('bulk_lots')
    .update(updates)
    .eq('id', lot.id);

  if (updateErr) throw updateErr;

  return { batched: true, bulk_lot_id: lot.id };
}

// ---------------------------------------------------------------------------
// Internal: create a brand-new forming lot
// ---------------------------------------------------------------------------

async function _createLot(listing) {
  // Look up the bulk rate for this material type
  const { data: rateRow, error: rateErr } = await supabase
    .from('bulk_rates')
    .select('rate_per_kg')
    .eq('material_type', listing.material_type)
    .maybeSingle();

  if (rateErr) throw rateErr;

  // Fallback to a sensible default if no rate is configured
  const bulkRatePerKg = rateRow ? rateRow.rate_per_kg : 1.0;

  const { data: newLot, error: lotErr } = await supabase
    .from('bulk_lots')
    .insert({
      material_type: listing.material_type,
      sub_grade: listing.sub_grade,
      status: 'forming',
      total_quantity: listing.quantity,
      bulk_rate_per_kg: bulkRatePerKg,
    })
    .select()
    .single();

  if (lotErr) throw lotErr;

  const { error: itemErr } = await supabase
    .from('bulk_lot_items')
    .insert({
      bulk_lot_id: newLot.id,
      listing_id: listing.id,
      seller_id: listing.seller_id,
      quantity: listing.quantity,
      pickup_lat: listing.pickup_lat,
      pickup_long: listing.pickup_long,
    });

  if (itemErr) throw itemErr;

  // A single-item lot can only reach min_items if min is 1
  if (1 >= config.BATCH_MIN_ITEMS) {
    const { error: flipErr } = await supabase
      .from('bulk_lots')
      .update({ status: 'open' })
      .eq('id', newLot.id);

    if (flipErr) throw flipErr;
  }

  return { batched: true, bulk_lot_id: newLot.id };
}

// ---------------------------------------------------------------------------
// 2. checkFormingLotTimeouts
// ---------------------------------------------------------------------------

/**
 * Dissolve forming lots that have exceeded BATCH_FORMING_TIMEOUT_SECONDS.
 * Individual listings' decay/fallback timelines were never paused, so the
 * only cleanup needed is removing the lot and its items.
 *
 * @returns {number} count of lots dissolved
 */
async function checkFormingLotTimeouts() {
  const cutoff = new Date(
    Date.now() - config.BATCH_FORMING_TIMEOUT_SECONDS * 1000,
  ).toISOString();

  const { data: staleLots, error: fetchErr } = await supabase
    .from('bulk_lots')
    .select('id')
    .eq('status', 'forming')
    .lte('created_at', cutoff);

  if (fetchErr) throw fetchErr;
  if (!staleLots || staleLots.length === 0) return 0;

  const lotIds = staleLots.map((l) => l.id);

  // Delete child items first
  const { error: delItemsErr } = await supabase
    .from('bulk_lot_items')
    .delete()
    .in('bulk_lot_id', lotIds);

  if (delItemsErr) throw delItemsErr;

  // Mark lots as dissolved
  const { error: dissolveErr } = await supabase
    .from('bulk_lots')
    .update({ status: 'dissolved' })
    .in('id', lotIds);

  if (dissolveErr) throw dissolveErr;

  return lotIds.length;
}

// ---------------------------------------------------------------------------
// 3. removeListingFromLot
// ---------------------------------------------------------------------------

/**
 * Remove a listing from its bulk lot, decrementing the lot's total_quantity.
 * Dissolves the lot if total_quantity drops to zero.
 *
 * @param {string} listingId
 * @returns {{ removed: boolean, lot_dissolved?: boolean }}
 */
async function removeListingFromLot(listingId) {
  // Find the item row
  const { data: item, error: findErr } = await supabase
    .from('bulk_lot_items')
    .select('id, bulk_lot_id, quantity')
    .eq('listing_id', listingId)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!item) return { removed: false };

  // Delete the item
  const { error: delErr } = await supabase
    .from('bulk_lot_items')
    .delete()
    .eq('id', item.id);

  if (delErr) throw delErr;

  // Fetch current lot
  const { data: lot, error: lotErr } = await supabase
    .from('bulk_lots')
    .select('id, total_quantity')
    .eq('id', item.bulk_lot_id)
    .single();

  if (lotErr) throw lotErr;

  const newTotal = (lot.total_quantity || 0) - item.quantity;

  if (newTotal <= 0) {
    // Dissolve the lot entirely
    const { error: dissolveErr } = await supabase
      .from('bulk_lots')
      .update({ status: 'dissolved', total_quantity: 0 })
      .eq('id', lot.id);

    if (dissolveErr) throw dissolveErr;

    return { removed: true, lot_dissolved: true };
  }

  // Just decrement
  const { error: updateErr } = await supabase
    .from('bulk_lots')
    .update({ total_quantity: newTotal })
    .eq('id', lot.id);

  if (updateErr) throw updateErr;

  return { removed: true, lot_dissolved: false };
}

module.exports = {
  checkBatchEligibility,
  checkFormingLotTimeouts,
  removeListingFromLot,
};
