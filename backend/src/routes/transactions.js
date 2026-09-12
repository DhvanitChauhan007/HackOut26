const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { getDistance } = require('../services/distanceMatrix');
const { createNotification } = require('../services/notifications');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fetch a transaction by id, along with its listing (joined).
 */
async function fetchTransactionWithListing(transactionId) {
  const { data: transaction, error } = await supabase
    .from('transactions')
    .select('*, listing:listings(*)')
    .eq('id', transactionId)
    .single();

  return { transaction, error };
}

// ─── POST /api/transactions/:id/estimate ────────────────────────────────────

/**
 * Compute distance + estimated cost between listing pickup and buyer location.
 */
router.post('/:id/estimate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { transaction, error: txError } = await fetchTransactionWithListing(id);
    if (txError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Fetch buyer profile for lat/long
    const { data: buyer, error: buyerError } = await supabase
      .from('users')
      .select('*')
      .eq('id', transaction.buyer_id)
      .single();

    if (buyerError || !buyer) {
      return res.status(404).json({ error: 'Buyer profile not found' });
    }

    if (buyer.lat == null || buyer.long == null) {
      return res.status(400).json({ error: 'Buyer profile is missing location coordinates' });
    }

    let total_distance_km = 0;
    let total_duration_min = 0;

    if (transaction.bulk_lot_id) {
      // Bulk transaction: sum of legs in insertion order
      const { data: items, error: itemsErr } = await supabase
        .from('bulk_lot_items')
        .select('*')
        .eq('bulk_lot_id', transaction.bulk_lot_id)
        .order('created_at', { ascending: true });

      if (itemsErr || !items || items.length === 0) {
        return res.status(400).json({ error: 'Bulk lot items not found' });
      }

      let prevLat = null;
      let prevLong = null;

      for (const item of items) {
        if (item.pickup_lat == null || item.pickup_long == null) continue;
        if (prevLat != null && prevLong != null) {
          const leg = await getDistance(prevLat, prevLong, item.pickup_lat, item.pickup_long);
          total_distance_km += leg.distance_km;
          total_duration_min += leg.duration_min;
        }
        prevLat = item.pickup_lat;
        prevLong = item.pickup_long;
      }
      
      // Final leg to buyer
      if (prevLat != null && prevLong != null) {
        const leg = await getDistance(prevLat, prevLong, buyer.lat, buyer.long);
        total_distance_km += leg.distance_km;
        total_duration_min += leg.duration_min;
      }
    } else {
      // Single listing transaction
      const listing = transaction.listing;
      if (!listing) {
        return res.status(404).json({ error: 'Associated listing not found' });
      }
      if (listing.pickup_lat == null || listing.pickup_long == null) {
        return res.status(400).json({ error: 'Listing is missing pickup coordinates' });
      }
      const leg = await getDistance(listing.pickup_lat, listing.pickup_long, buyer.lat, buyer.long);
      total_distance_km = leg.distance_km;
      total_duration_min = leg.duration_min;
    }

    const estimated_cost = Math.round(total_distance_km * config.COST_PER_KM * 100) / 100;

    // Update the transaction
    const { data: updated, error: updateError } = await supabase
      .from('transactions')
      .update({ distance_km: total_distance_km, estimated_cost, status: 'estimated' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update transaction estimate error:', updateError);
      return res.status(500).json({ error: 'Failed to update transaction estimate' });
    }

    return res.status(200).json({ distance_km: total_distance_km, estimated_cost, duration_min: total_duration_min });
  } catch (err) {
    console.error('POST /api/transactions/:id/estimate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/transactions/:id/commit ──────────────────────────────────────

/**
 * Commit an estimated transaction: update status and create a logistics job.
 */
router.post('/:id/commit', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { transaction, error: txError } = await fetchTransactionWithListing(id);
    if (txError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'estimated') {
      return res.status(400).json({ error: 'Transaction must be in "estimated" status to commit' });
    }

    // Fetch buyer profile for dropoff coordinates
    const { data: buyer, error: buyerError } = await supabase
      .from('users')
      .select('*')
      .eq('id', transaction.buyer_id)
      .single();

    if (buyerError || !buyer) {
      return res.status(404).json({ error: 'Buyer profile not found' });
    }

    let firstPickupLat = null;
    let firstPickupLong = null;
    let bulkItems = [];

    if (transaction.bulk_lot_id) {
      const { data: items, error: itemsErr } = await supabase
        .from('bulk_lot_items')
        .select('*')
        .eq('bulk_lot_id', transaction.bulk_lot_id)
        .order('created_at', { ascending: true });

      if (itemsErr || !items || items.length === 0) {
        return res.status(400).json({ error: 'Bulk lot items not found' });
      }
      bulkItems = items;
      // Set job pickup coords to the first stop's coords for sorting
      firstPickupLat = items[0].pickup_lat;
      firstPickupLong = items[0].pickup_long;
    } else {
      const listing = transaction.listing;
      if (!listing) return res.status(404).json({ error: 'Associated listing not found' });
      firstPickupLat = listing.pickup_lat;
      firstPickupLong = listing.pickup_long;
    }

    // Update transaction status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ status: 'committed' })
      .eq('id', id);

    if (updateError) {
      console.error('Commit transaction error:', updateError);
      return res.status(500).json({ error: 'Failed to commit transaction' });
    }

    // Create the logistics job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        transaction_id: id,
        pickup_lat: firstPickupLat,
        pickup_long: firstPickupLong,
        dropoff_lat: buyer.lat,
        dropoff_long: buyer.long,
        distance_km: transaction.distance_km,
        estimated_cost: transaction.estimated_cost,
        status: 'open',
      })
      .select()
      .single();

    if (jobError) {
      console.error('Create job error:', jobError);
      return res.status(500).json({ error: 'Failed to create logistics job' });
    }

    // Create job_stops for bulk lots
    if (transaction.bulk_lot_id && bulkItems.length > 0) {
      const stops = bulkItems.map((item, index) => ({
        job_id: job.id,
        listing_id: item.listing_id,
        seller_id: item.seller_id,
        pickup_lat: item.pickup_lat,
        pickup_long: item.pickup_long,
        seq_order: index + 1
      }));
      
      const { error: stopsErr } = await supabase.from('job_stops').insert(stops);
      if (stopsErr) {
        console.error('Failed to create job stops:', stopsErr);
        // Continue, don't fail the whole request
      }
    }

    return res.status(201).json(job);
  } catch (err) {
    console.error('POST /api/transactions/:id/commit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/transactions/:id/ratings ─────────────────────────────────────

/**
 * Submit a rating for a completed transaction.
 * Supports both single-seller and bulk (multi-seller) transactions.
 */
router.post('/:id/ratings', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let { ratee_id, rating, comment } = req.body;

    if (rating == null || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating is required and must be between 1 and 5' });
    }

    // Fetch the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'completed') {
      return res.status(400).json({ error: 'Ratings can only be submitted for completed transactions' });
    }

    const callerId = req.user.id;
    const isBuyer = callerId === transaction.buyer_id;
    const isSingleSeller = callerId === transaction.seller_id;

    // For bulk transactions, check if the caller is a contributing seller
    let isBulkSeller = false;
    if (!isBuyer && !isSingleSeller && transaction.bulk_lot_id) {
      const { data: lotItems } = await supabase
        .from('bulk_lot_items')
        .select('seller_id')
        .eq('bulk_lot_id', transaction.bulk_lot_id);

      if (lotItems) {
        isBulkSeller = lotItems.some((i) => i.seller_id === callerId);
      }
    }

    if (!isBuyer && !isSingleSeller && !isBulkSeller) {
      return res.status(403).json({ error: 'Only transaction parties can submit ratings' });
    }

    // Infer ratee_id for single-seller transactions
    if (!ratee_id) {
      if (transaction.bulk_lot_id) {
        return res.status(400).json({ error: 'ratee_id is required for bulk transactions' });
      }
      // Single-seller: infer the other party
      ratee_id = isBuyer ? transaction.seller_id : transaction.buyer_id;
    }

    // For bulk transactions, validate that ratee_id is a legitimate party
    if (transaction.bulk_lot_id) {
      const validParties = new Set([transaction.buyer_id]);
      const { data: lotItems } = await supabase
        .from('bulk_lot_items')
        .select('seller_id')
        .eq('bulk_lot_id', transaction.bulk_lot_id);

      if (lotItems) {
        lotItems.forEach((i) => validParties.add(i.seller_id));
      }

      if (!validParties.has(ratee_id)) {
        return res.status(400).json({ error: 'ratee_id must be a valid party in this transaction' });
      }
    }

    // Prevent self-rating
    if (callerId === ratee_id) {
      return res.status(400).json({ error: 'You cannot rate yourself' });
    }

    // Check uniqueness: (transaction_id, rater_id, ratee_id)
    const { data: existing, error: existError } = await supabase
      .from('ratings')
      .select('id')
      .eq('transaction_id', id)
      .eq('rater_id', callerId)
      .eq('ratee_id', ratee_id)
      .maybeSingle();

    if (existError) {
      console.error('Rating uniqueness check error:', existError);
      return res.status(500).json({ error: 'Failed to verify rating uniqueness' });
    }

    if (existing) {
      return res.status(409).json({ error: 'You have already rated this party for this transaction' });
    }

    // Insert the rating
    const { data: ratingRow, error: insertError } = await supabase
      .from('ratings')
      .insert({
        transaction_id: id,
        rater_id: callerId,
        ratee_id,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Rating insert error:', insertError);
      return res.status(500).json({ error: 'Failed to submit rating' });
    }

    // Best-effort notification to the ratee
    await createNotification(
      ratee_id,
      `You received a ${rating}-star rating.`,
      'rating_received',
    );

    return res.status(201).json(ratingRow);
  } catch (err) {
    console.error('POST /api/transactions/:id/ratings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
