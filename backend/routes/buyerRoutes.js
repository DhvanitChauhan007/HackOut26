import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// 1. Request a listing
router.post('/listings/:id/requests', requireAuth, async (req, res) => {
  const listingId = req.params.id;
  const buyerId = req.user.id;

  try {
    // Check if request already exists
    const { data: existing } = await supabaseAdmin
      .from('requests')
      .select('*')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .maybeSingle();

    if (existing) {
      return res.json(existing);
    }

    const { data, error } = await supabaseAdmin
      .from('requests')
      .insert({ listing_id: listingId, buyer_id: buyerId, status: 'pending' })
      .select()
      .single();

    if (error) {
      console.error('Error inserting request:', error);
      return res.status(400).json({ error: error.message });
    }
    res.json(data);
  } catch (err) {
    console.error('Unexpected error in request listing:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Estimate cost (distance calculation placeholder for now)
router.post('/transactions/:id/estimate', requireAuth, async (req, res) => {
  const transactionId = req.params.id;
  
  const distanceKm = 15.5; 
  const costPerKm = parseFloat(process.env.COST_PER_KM || 0.75);
  const estimatedCost = distanceKm * costPerKm;

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .update({ 
      distance_km: distanceKm, 
      estimated_cost: estimatedCost, 
      status: 'estimated' 
    })
    .eq('id', transactionId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 3. Commit transaction
router.post('/transactions/:id/commit', requireAuth, async (req, res) => {
  const transactionId = req.params.id;

  // Mark transaction as committed
  const { data: trx, error: trxError } = await supabaseAdmin
    .from('transactions')
    .update({ status: 'committed' })
    .eq('id', transactionId)
    .select('*, listings(*), buyer:buyer_id(lat, long)')
    .single();

  if (trxError) return res.status(400).json({ error: trxError.message });

  // Get real pickup & dropoff coordinates
  const pickupLat = trx.listings?.pickup_lat || 13.0285;
  const pickupLong = trx.listings?.pickup_long || 77.5197;
  const dropoffLat = trx.buyer?.lat || 13.0358;
  const dropoffLong = trx.buyer?.long || 77.5972;

  const pickupLocation = trx.listings?.condition?.split('|')?.[1]?.replace('Pickup:', '')?.trim() ||
                         trx.listings?.users?.address ||
                         'Industrial Zone, Bengaluru';
  const dropoffLocation = trx.buyer?.address || 'Hebbal Facility, Bengaluru';
  const durationMin = Math.round((trx.distance_km || 15.5) * 2.2);

  // Create a job for logistics with accurate coordinates and location labels
  const { error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert({
      transaction_id: transactionId,
      pickup_lat: pickupLat,
      pickup_long: pickupLong,
      dropoff_lat: dropoffLat,
      dropoff_long: dropoffLong,
      distance_km: trx.distance_km || 15.5,
      estimated_cost: trx.estimated_cost || 1850.00,
      duration_min: durationMin,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      status: 'open'
    });

  if (jobError) return res.status(400).json({ error: jobError.message });
  res.json(trx);
});

// 4. Rate a transaction
router.post('/transactions/:id/ratings', requireAuth, async (req, res) => {
  const { ratee_id, rating, comment } = req.body;
  const transactionId = req.params.id;

  const { data, error } = await supabaseAdmin
    .from('ratings')
    .insert({
      transaction_id: transactionId,
      rater_id: req.user.id,
      ratee_id,
      rating,
      comment
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 5. Purchase Bulk Lot directly
router.post('/bulk-lots/:id/purchase', requireAuth, async (req, res) => {
  const bulkLotId = req.params.id;
  
  await supabaseAdmin.from('bulk_lots').update({ status: 'claimed' }).eq('id', bulkLotId);
  
  const { data: trx, error } = await supabaseAdmin
    .from('transactions')
    .insert({
      bulk_lot_id: bulkLotId,
      buyer_id: req.user.id,
      status: 'committed'
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Look up contributing items
  const { data: items } = await supabaseAdmin
    .from('bulk_lot_items')
    .select('*')
    .eq('bulk_lot_id', bulkLotId);

  // Look up buyer coordinates
  const { data: buyer } = await supabaseAdmin.from('users').select('lat, long').eq('id', req.user.id).single();
  const dropoffLat = buyer?.lat || 13.0358;
  const dropoffLong = buyer?.long || 77.5972;

  // Create multi-stop job for logistics
  const firstStop = items?.[0];
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .insert({
      transaction_id: trx.id,
      pickup_lat: firstStop?.pickup_lat || 13.0285,
      pickup_long: firstStop?.pickup_long || 77.5197,
      dropoff_lat: dropoffLat,
      dropoff_long: dropoffLong,
      distance_km: (items?.length || 1) * 14.5,
      estimated_cost: (items?.length || 1) * 1950,
      duration_min: (items?.length || 1) * 28,
      pickup_location: 'Multi-Seller Waypoint Pool',
      dropoff_location: buyer?.address || 'Hebbal Facility, Bengaluru',
      status: 'open'
    })
    .select()
    .single();

  // Insert sequential job_stops
  if (job && items?.length) {
    const stopsToInsert = items.map((item, idx) => ({
      job_id: job.id,
      listing_id: item.listing_id,
      seller_id: item.seller_id,
      pickup_lat: item.pickup_lat,
      pickup_long: item.pickup_long,
      seq_order: idx + 1
    }));
    await supabaseAdmin.from('job_stops').insert(stopsToInsert);
  }

  res.json(trx);
});

// 6. Impact Summary
router.get('/impact/summary', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('impact_kg_diverted, impact_co2e_kg')
    .eq('buyer_id', req.user.id)
    .eq('status', 'completed');

  if (error) return res.status(400).json({ error: error.message });

  const totalDiverted = data.reduce((sum, t) => sum + (Number(t.impact_kg_diverted) || 0), 0);
  const totalCo2e = data.reduce((sum, t) => sum + (Number(t.impact_co2e_kg) || 0), 0);

  res.json({
    total_kg_diverted: totalDiverted,
    total_co2e_avoided: totalCo2e,
    total_savings: 0
  });
});

// GET /api/transactions
router.get('/transactions', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*, listings(*, users(name, address)), seller:seller_id(name, address), jobs(*, users:logistics_company_id(name))')
    .eq('buyer_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/requests
router.get('/requests', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('requests')
    .select('*, listings(*, users(name, address))')
    .eq('buyer_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
