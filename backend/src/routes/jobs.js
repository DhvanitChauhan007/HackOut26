const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { haversine } = require('../utils/haversine');
const { computeImpact } = require('../services/impactCalc');
const { createNotification } = require('../services/notifications');

/**
 * Middleware: ensure the authenticated user has the 'logistics' role.
 */
function requireLogistics(req, res, next) {
  if (!req.profile || req.profile.role !== 'logistics') {
    return res.status(403).json({ error: 'Only logistics users can access this resource' });
  }
  next();
}

/**
 * GET /api/jobs
 * List jobs, optionally filtered by status and sorted by proximity.
 */
router.get('/', requireAuth, requireLogistics, async (req, res) => {
  try {
    const { status, lat, long } = req.query;

    let query = supabase.from('jobs').select('*');

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Fetch jobs error:', error);
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }

    // Application-side proximity sort using haversine
    if (lat && long) {
      const userLat = parseFloat(lat);
      const userLon = parseFloat(long);

      jobs.sort((a, b) => {
        const distA = (a.pickup_lat != null && a.pickup_long != null)
          ? haversine(userLat, userLon, a.pickup_lat, a.pickup_long)
          : Infinity;
        const distB = (b.pickup_lat != null && b.pickup_long != null)
          ? haversine(userLat, userLon, b.pickup_lat, b.pickup_long)
          : Infinity;
        return distA - distB;
      });
    }

    return res.status(200).json(jobs);
  } catch (err) {
    console.error('GET /api/jobs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/jobs/:id/claim
 * Logistics company claims an open job.
 */
router.post('/:id/claim', requireAuth, requireLogistics, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the job
    const { data: job, error: fetchErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'open') {
      return res.status(409).json({ error: 'Job is no longer open for claiming' });
    }

    // Assign the job
    const { data: updated, error: updateErr } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        logistics_company_id: req.user.id,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('Claim job update error:', updateErr);
      return res.status(500).json({ error: 'Failed to claim job' });
    }

    // Notify buyer and seller via transaction lookup
    const { data: txn } = await supabase
      .from('transactions')
      .select('buyer_id, seller_id')
      .eq('id', job.transaction_id)
      .single();

    if (txn) {
      const notificationMsg = 'A carrier has been assigned to your shipment';
      const targets = [txn.buyer_id, txn.seller_id].filter(Boolean);
      await Promise.all(targets.map((uid) => createNotification(uid, notificationMsg, 'shipment')));
    }

    return res.status(200).json(updated);
  } catch (err) {
    console.error('POST /api/jobs/:id/claim error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/jobs/:id/deliver
 * Mark a job as delivered. Completes the transaction and computes environmental impact.
 */
router.post('/:id/deliver', requireAuth, requireLogistics, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the job
    const { data: job, error: fetchErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'assigned') {
      return res.status(409).json({ error: 'Job is not in assigned status' });
    }

    if (job.logistics_company_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the assigned logistics company can deliver this job' });
    }

    const now = new Date().toISOString();

    // 1. Update job status
    const { data: updatedJob, error: jobUpdateErr } = await supabase
      .from('jobs')
      .update({ status: 'delivered', delivered_at: now })
      .eq('id', id)
      .select()
      .single();

    if (jobUpdateErr) {
      console.error('Deliver job update error:', jobUpdateErr);
      return res.status(500).json({ error: 'Failed to update job status' });
    }

    // 2. Fetch the transaction
    const { data: transaction, error: txnErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', job.transaction_id)
      .single();

    if (txnErr || !transaction) {
      console.error('Fetch transaction error:', txnErr);
      return res.status(500).json({ error: 'Failed to fetch associated transaction' });
    }

    // 3. Compute impact — handle both single-listing and bulk transactions
    let totalKgDiverted = 0;
    let totalCo2eKg = 0;

    if (transaction.bulk_lot_id) {
      // Bulk transaction: fetch contributing listings via bulk_lot_items
      const { data: items, error: itemsErr } = await supabase
        .from('bulk_lot_items')
        .select('listing_id')
        .eq('bulk_lot_id', transaction.bulk_lot_id);

      if (itemsErr) {
        console.error('Fetch bulk lot items error:', itemsErr);
        return res.status(500).json({ error: 'Failed to fetch listings for impact calculation' });
      }

      const listingIds = items.map((i) => i.listing_id);

      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, material_type, quantity')
          .in('id', listingIds);

        if (listings) {
          const impacts = await Promise.all(
            listings.map((l) => computeImpact(l.material_type, l.quantity))
          );
          for (const impact of impacts) {
            totalKgDiverted += impact.impact_kg_diverted;
            totalCo2eKg += impact.impact_co2e_kg;
          }

          // Mark all listings as completed
          await supabase.from('listings').update({ status: 'completed' }).in('id', listingIds);
        }
      }

      // Mark bulk lot as completed
      await supabase.from('bulk_lots').update({ status: 'completed' }).eq('id', transaction.bulk_lot_id);
    } else {
      // Single listing transaction
      const { data: listing, error: listingErr } = await supabase
        .from('listings')
        .select('id, material_type, quantity')
        .eq('id', transaction.listing_id)
        .single();

      if (listingErr || !listing) {
        console.error('Fetch listing error:', listingErr);
        return res.status(500).json({ error: 'Failed to fetch listing for impact calculation' });
      }

      const impact = await computeImpact(listing.material_type, listing.quantity);
      totalKgDiverted = impact.impact_kg_diverted;
      totalCo2eKg = impact.impact_co2e_kg;

      // Mark listing as completed
      await supabase.from('listings').update({ status: 'completed' }).eq('id', listing.id);
    }

    // 4. Update the transaction
    await supabase
      .from('transactions')
      .update({
        status: 'completed',
        completed_at: now,
        impact_kg_diverted: totalKgDiverted,
        impact_co2e_kg: totalCo2eKg,
      })
      .eq('id', job.transaction_id);

    // 5. Notify buyer and seller
    let sellerIds = transaction.seller_id ? [transaction.seller_id] : [];
    if (transaction.bulk_lot_id) {
      const { data: bItems } = await supabase
        .from('bulk_lot_items')
        .select('seller_id')
        .eq('bulk_lot_id', transaction.bulk_lot_id);
      if (bItems) {
        sellerIds = bItems.map(i => i.seller_id).filter(Boolean);
      }
    }
    sellerIds = [...new Set(sellerIds)];

    await Promise.all([
      createNotification(transaction.buyer_id, 'Your material has been delivered', 'delivery'),
      ...sellerIds.map((uid) =>
        createNotification(uid, 'Delivery of your material has been confirmed', 'delivery')
      ),
    ]);

    return res.status(200).json(updatedJob);
  } catch (err) {
    console.error('POST /api/jobs/:id/deliver error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
